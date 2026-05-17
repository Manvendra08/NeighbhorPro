import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { auth } from "../firebase";
import { db } from "../firebase";
import { mirrorPublicProfile } from "./userService";

export async function addReview(
  bookingId: string, proId: string, rating: number, comment: string
) {
  if (!auth.currentUser) throw new Error("Must be logged in to review");
  const clientId = auth.currentUser.uid;
  const normalizedRating = Math.trunc(Number(rating));
  const normalizedComment = comment.trim();
  if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
    throw new Error("Rating must be an integer between 1 and 5.");
  }
  if (!normalizedComment || normalizedComment.length > 1000) {
    throw new Error("Comment must be between 1 and 1000 characters.");
  }
  const reviewId = `${bookingId}_${clientId}`;
  const reviewRef = doc(db, "reviews", reviewId);
  const bookingRef = doc(db, "bookings", bookingId);
  const proRef = doc(db, "users", proId);
  const proPublicRef = doc(db, "publicProfiles", proId);

  await runTransaction(db, async tx => {
    const existing = await tx.get(reviewRef);
    if (existing.exists()) throw new Error("You have already submitted a review for this booking.");
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error("Booking not found.");
    const booking = bookingSnap.data() as Record<string, unknown>;
    const bookingClientId = String(booking.clientId || booking.clientUid || "");
    const bookingProId = String(booking.proId || booking.proUid || "");
    const bookingStatus = String(booking.status || "");
    if (bookingClientId !== clientId) throw new Error("Only the booking client can submit a review.");
    if (bookingProId !== proId) throw new Error("Review professional does not match booking.");
    if (!['completed', 'reviewed'].includes(bookingStatus)) {
      throw new Error("Review can only be submitted after booking completion.");
    }

    const proSnap = await tx.get(proRef);
    const proData = proSnap.data() || {};
    const currentReviewCount = Number.isFinite(Number(proData.reviewCount))
      ? Number(proData.reviewCount)
      : 0;
    const currentRating = Number.isFinite(Number(proData.rating))
      ? Number(proData.rating)
      : 0;
    const nextReviewCount = currentReviewCount + 1;
    const nextAverageRating =
      ((currentRating * currentReviewCount) + normalizedRating) / nextReviewCount;
    const aggregateUpdate = {
      rating: Math.round(nextAverageRating * 10) / 10,
      reviewCount: nextReviewCount,
    };

    tx.set(reviewRef, {
      bookingId, proId, clientId,
      clientName: auth.currentUser?.displayName || "User",
      clientPhoto: auth.currentUser?.photoURL || "",
      rating: normalizedRating,
      comment: normalizedComment,
      createdAt: serverTimestamp(),
    });
    tx.update(proRef, { ...aggregateUpdate, updatedAt: serverTimestamp() });
    tx.set(proPublicRef, { ...aggregateUpdate, updatedAt: serverTimestamp() }, { merge: true });
  });
}

export async function addResidentReview(
  bookingId: string, clientId: string, rating: number, comment: string
) {
  if (!auth.currentUser) throw new Error("Must be logged in to review");
  const proId = auth.currentUser.uid;
  const reviewId = `${bookingId}_${proId}`;
  const reviewRef = doc(db, "residentReviews", reviewId);
  const bookingRef = doc(db, "bookings", bookingId);

  await runTransaction(db, async tx => {
    const existing = await tx.get(reviewRef);
    if (existing.exists()) throw new Error("You have already rated this resident for this booking.");
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error("Booking not found.");
    const booking = bookingSnap.data() as Record<string, unknown>;
    const status = String(booking.status || "");
    const bookingClientId = String(booking.clientId || booking.clientUid || "");
    const bookingProId = String(booking.proId || booking.proUid || "");
    if (bookingProId !== proId) throw new Error("Only booking professional can rate resident.");
    if (bookingClientId !== clientId) throw new Error("Resident mismatch for this booking.");
    if (!['completed', 'reviewed'].includes(status)) throw new Error("Resident can be rated only after completion.");
    tx.set(reviewRef, {
      bookingId, clientId, proId,
      reviewerRole: "pro",
      rating, comment,
      createdAt: serverTimestamp(),
    });
  });
}

export async function hasResidentReview(bookingId: string, proId: string): Promise<boolean> {
  if (!bookingId || !proId) return false;
  const snap = await getDoc(doc(db, "residentReviews", `${bookingId}_${proId}`));
  return snap.exists();
}

export async function getReviewsForUser(proId: string) {
  const q = query(collection(db, "reviews"), where("proId", "==", proId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

export async function getReviewDistribution(proId: string): Promise<Record<number, number>> {
  const reviews = await getReviewsForUser(proId);
  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const review of reviews) {
    const r = Number(review.rating);
    if (Number.isFinite(r) && r >= 1 && r <= 5) distribution[Math.round(r)] += 1;
  }
  return distribution;
}

/**
 * Recalculates and persists the pro's rating aggregate.
 *
 * @deprecated
 * In production, rating recalculation is handled server-side by the
 * `onReviewWrite` Cloud Function trigger (functions/src/index.ts).
 * This function is retained as a fallback for local emulator testing
 * or one-off admin backfills only. Do NOT call it from user-facing flows.
 */
export async function recalculateProRating(
  proId: string
): Promise<{ rating: number; reviewCount: number }> {
  const allReviews = await getReviewsForUser(proId);
  const validRatings = allReviews
    .map(r => Number(r.rating))
    .filter(r => Number.isFinite(r) && r >= 1 && r <= 5);
  const avg = validRatings.length > 0
    ? validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length
    : 0;
  const update = { rating: Math.round(avg * 10) / 10, reviewCount: allReviews.length };
  await updateDoc(doc(db, "users", proId), update);
  await mirrorPublicProfile(proId, update);
  return update;
}

export async function checkSpamReviews(proId: string) {
  // Deprecated: spam checks run in Cloud Functions. No-op for backward compatibility.
  void proId;
}

export async function hasUserReportedProfessional(
  proId: string, reporterId: string
): Promise<boolean> {
  const snap = await getDoc(doc(db, "reports", `${proId}_${reporterId}`));
  return snap.exists();
}

export async function reportProfessional(
  proId: string, reason: string, comment: string
): Promise<{ success: boolean; alreadyReported?: boolean }> {
  if (!auth.currentUser) throw new Error("Must be logged in to report");
  const reporterId = auth.currentUser.uid;
  const pairId = `${proId}_${reporterId}`;
  const reportRef = doc(db, "reports", pairId);
  const existing = await getDoc(reportRef);
  if (existing.exists()) return { success: false, alreadyReported: true };
  await setDoc(reportRef, {
    id: pairId, proId, reporterId, reason, comment,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { success: true };
}
