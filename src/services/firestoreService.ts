import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  Timestamp,
  runTransaction,
  getCountFromServer,
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "../firebase";
import { generateReferralCode } from "./coinService";
import { validateUpload } from "../utils/cloudinary";

/* ═══════════════════════════════════════════
   USERS
═══════════════════════════════════════════ */

// Fields safe to expose to any signed-in user. Sensitive fields
// (phoneNumber, flatNumber, coinBalance, fcmToken, referralCode,
// residencyProofUrl, email) are deliberately excluded.
const PUBLIC_PROFILE_FIELDS = [
  'uid', 'displayName', 'photoURL', 'bio', 'skills', 'isServiceProvider',
  'rating', 'reviewCount', 'society', 'locality', 'tower',
  'residentVerificationStatus', 'hourlyRate', 'isFreeConsultation',
  'priceAfterQuote', 'role', 'disabled', 'createdAt', 'highestLoyaltyTier',
] as const;

const AVAILABILITY_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map(item => item.trim())
          .filter(Boolean)
      )
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map(item => item.trim())
          .filter(Boolean)
      )
    );
  }

  return [];
}

export function normalizeProfileData(data: Record<string, unknown>): Record<string, unknown> {
  return {
    ...data,
    skills: normalizeStringArray(data.skills),
  };
}

function normalizeAvailabilityDay(value: unknown): Record<string, unknown> {
  const day = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return {
    ...day,
    active: Boolean(day.active),
    slots: normalizeStringArray(day.slots),
  };
}

export function normalizeAvailabilityData(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) return null;

  const normalized: Record<string, unknown> = { ...data };
  for (const day of AVAILABILITY_DAYS) {
    normalized[day] = normalizeAvailabilityDay(data[day]);
  }

  return normalized;
}

/**
 * Mirror safe fields to /publicProfiles on every profile mutation.
 * Readable by any signed-in user; never contains sensitive data.
 */
export async function mirrorPublicProfile(uid: string, data: any): Promise<void> {
  const safe: Record<string, unknown> = { uid };
  for (const field of PUBLIC_PROFILE_FIELDS) {
    if (field in data) safe[field] = data[field as string];
  }
  if (Object.keys(safe).length <= 1) return; // only uid, nothing to write
  await setDoc(
    doc(db, 'publicProfiles', uid),
    { ...safe, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * Read a user's FULL document — owner/admin only.
 * For Browse, ProDetail, Messages sidebar, BookingFlow: use getPublicProfile.
 */
export async function getUserProfile(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? normalizeProfileData({ uid: snap.id, ...snap.data() }) : null;
}

/**
 * Read public-safe profile — accessible to any signed-in user.
 * Falls back to /users with field-stripping for legacy accounts not yet mirrored.
 */
export async function getPublicProfile(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'publicProfiles', uid));
  if (snap.exists()) return normalizeProfileData({ uid: snap.id, ...snap.data() });
  // Legacy fallback: strip sensitive fields from /users document
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) return null;
  const full = userSnap.data() as Record<string, unknown>;
  const stripped: Record<string, unknown> = { uid };
  for (const field of PUBLIC_PROFILE_FIELDS) {
    if (field in full) stripped[field] = full[field as string];
  }
  return normalizeProfileData(stripped);
}



export async function updateUserProfile(uid: string, data: Record<string, unknown>) {
  const userRef = doc(db, "users", uid);
  const current = await getDoc(userRef);
  const currentData = current.data() ?? {};

  const nextData: Record<string, unknown> = { ...data };
  const nextDisplayName = (typeof data.displayName === "string" ? data.displayName : (currentData.displayName as string | undefined)) ?? "";
  const nextPhone = (typeof data.phoneNumber === "string" ? data.phoneNumber : (currentData.phoneNumber as string | undefined)) ?? "";

  if (typeof data.displayName === "string" || typeof data.phoneNumber === "string") {
    nextData.referralCode = generateReferralCode({
      displayName: nextDisplayName,
      phoneNumber: nextPhone,
      uid,
    });
  }

  await updateDoc(userRef, { ...nextData, updatedAt: serverTimestamp() });
  // Mirror safe fields to /publicProfiles so other users never need /users
  await mirrorPublicProfile(uid, { ...currentData, ...nextData });
}

export async function uploadProfilePhoto(uid: string, file: File) {
  validateUpload(file, "profilePhoto"); // throws if invalid
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary configuration is missing.");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "ProNeighbor/profiles");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error?.message || "Upload failed"); }
  const data = await response.json();
  const photoURL = data.secure_url;
  if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL });
  await updateDoc(doc(db, "users", uid), { photoURL, updatedAt: serverTimestamp() });
  await mirrorPublicProfile(uid, { photoURL });
  return photoURL;
}

export async function uploadResidencyProof(uid: string, file: File) {
  validateUpload(file, "residencyProof"); // throws if invalid

  // 1. Call Cloud Function to get signed upload parameters
  const { httpsCallable } = await import("firebase/functions");
  const { functionsClient } = await import("../firebase");
  const generateSig = httpsCallable<{ /* no arguments needed */ }, { signature: string, timestamp: number, folder: string, apiKey: string }>(functionsClient, "generateCloudinarySignature");

  const { data: sigData } = await generateSig();

  // 2. Upload directly to Cloudinary using the authenticated parameters
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error("Cloudinary configuration is missing. Please contact support.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sigData.apiKey);
  formData.append("timestamp", sigData.timestamp.toString());
  formData.append("signature", sigData.signature);
  formData.append("folder", sigData.folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: formData });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Cloudinary upload failed");
  }
  const data = await response.json();
  const residencyProofUrl = data.secure_url;

  const update = {
    residencyProofUrl,
    residentVerificationStatus: "pending",
    verificationMethod: null,
    verificationReviewNote: null,
    verificationReviewedBy: null,
    verificationReviewedAt: null,
    verificationSubmittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "users", uid), update);
  await mirrorPublicProfile(uid, update);
  return residencyProofUrl;
}

export async function updateResidentVerification(
  uid: string,
  status: "none" | "pending" | "verified",
  method: "manual" | "auto" | null,
  reviewerUid?: string,
  reviewNote?: string
) {
  const update = {
    residentVerificationStatus: status,
    verificationMethod: method,
    verificationReviewedBy: reviewerUid || null,
    verificationReviewNote: reviewNote || null,
    verificationReviewedAt: status === "pending" ? null : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, "users", uid), update);
  await mirrorPublicProfile(uid, update);
}

/**
 * Fetches users with 'pending' residentVerificationStatus.
 * Used for admin approval workflow.
 */
export async function getPendingVerifications(): Promise<Record<string, unknown>[]> {
  const q = query(
    collection(db, "users"),
    where("residentVerificationStatus", "==", "pending"),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), uid: d.id }));
}

export const BROWSE_PAGE_SIZE = 20;

/**
 * Paginated professional listing ordered by createdAt desc.
 * Server-side locality/tower filtering uses Firestore where() clauses
 * to prevent the empty-page problem of client-side post-pagination filtering.
 * Composite indexes required: locality+createdAt and tower+createdAt.
 */
export async function listProfessionals(
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
  filters?: { locality?: string; tower?: string }
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot<DocumentData> | null }> {
  // Reads from /publicProfiles — safe fields only, accessible to any signed-in user.
  const constraints: Parameters<typeof query>[1][] = [orderBy("createdAt", "desc"), limit(BROWSE_PAGE_SIZE)];
  if (filters?.locality) constraints.unshift(where("locality", "==", filters.locality));
  if (filters?.tower) constraints.unshift(where("tower", "==", filters.tower));
  if (cursor) constraints.push(startAfter(cursor));

  const q = query(collection(db, "publicProfiles"), ...constraints);
  const snap = await getDocs(q);
  const data = snap.docs.map(d => normalizeProfileData({ uid: d.id, ...d.data() }));
  const nextCursor = snap.docs.length === BROWSE_PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}

export async function getAllUsers(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: any[] = [orderBy("createdAt", "desc"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "users"), ...(constraints as any[])));
  const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}

// Use this in UI components that only need rows and not pagination metadata.
export async function getAllUserRows(limit_ = 50): Promise<Record<string, unknown>[]> {
  const res = await getAllUsers(limit_);
  return Array.isArray(res.data) ? res.data : [];
}

/* ═══════════════════════════════════════════
   SERVICES
═══════════════════════════════════════════ */
export async function createService(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "services"), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}
export async function getServicesByUser(userId: string) {
  const q = query(collection(db, "services"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}
export async function getAllServices(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: any[] = [orderBy("createdAt", "desc"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "services"), ...(constraints as any[])));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}
export async function updateService(id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, "services", id), { ...data, updatedAt: serverTimestamp() });
}
export async function deleteService(id: string) { await deleteDoc(doc(db, "services", id)); }

/* ═══════════════════════════════════════════
   BOOKINGS
═══════════════════════════════════════════ */
export async function createBooking(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "bookings"), { ...data, status: "pending", createdAt: serverTimestamp() });
  return ref.id;
}
export async function updateBookingStatus(bookingId: string, status: string) {
  await updateDoc(doc(db, "bookings", bookingId), { status, updatedAt: serverTimestamp() });
}
export async function getBookingsForUser(uid: string) {
  const q = query(collection(db, "bookings"), where("clientId", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}
export async function getBookingsForPro(uid: string) {
  const primaryQuery = query(collection(db, "bookings"), where("proId", "==", uid), orderBy("createdAt", "desc"));
  const [primarySnap, legacySnap] = await Promise.all([
    getDocs(primaryQuery),
    getDocs(query(collection(db, "bookings"), where("proUid", "==", uid), orderBy("createdAt", "desc"))).catch(() => ({ docs: [] } as any)),
  ]);

  const merged = new Map<string, Record<string, unknown>>();
  for (const d of primarySnap.docs) {
    merged.set(d.id, { id: d.id, ...d.data() } as Record<string, unknown>);
  }
  for (const d of legacySnap.docs) {
    if (!merged.has(d.id)) {
      merged.set(d.id, { id: d.id, ...d.data() } as Record<string, unknown>);
    }
  }

  return Array.from(merged.values());
}
export async function getAllBookings(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: any[] = [orderBy("createdAt", "desc"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "bookings"), ...(constraints as any[])));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}
export async function getBookingById(bookingId: string) {
  const snap = await getDoc(doc(db, "bookings", bookingId));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Record<string, unknown> : null;
}
export async function getLatestBookingBetweenUsers(uid1: string, uid2: string): Promise<Record<string, unknown> | null> {
  const [asClient, asPro] = await Promise.all([
    getDocs(query(
      collection(db, "bookings"),
      where("clientId", "==", uid1),
      where("proId", "==", uid2),
      orderBy("createdAt", "desc"),
      limit(1)
    )).catch(() => ({ docs: [] } as any)),
    getDocs(query(
      collection(db, "bookings"),
      where("clientId", "==", uid2),
      where("proId", "==", uid1),
      orderBy("createdAt", "desc"),
      limit(1)
    )).catch(() => ({ docs: [] } as any)),
  ]);

  const candidates = [...asClient.docs, ...asPro.docs];
  if (!candidates.length) return null;

  const latest = candidates.sort((a, b) => {
    const aSec = (a.data()?.createdAt as Timestamp | undefined)?.seconds ?? 0;
    const bSec = (b.data()?.createdAt as Timestamp | undefined)?.seconds ?? 0;
    return bSec - aSec;
  })[0];

  return { id: latest.id, ...latest.data() } as Record<string, unknown>;
}
export async function getLastCompletedBookingForUser(uid: string) {
  const q = query(
    collection(db, "bookings"),
    where("clientId", "==", uid),
    where("status", "in", ["completed", "reviewed"]),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Record<string, unknown>);
}
export async function updateBookingFields(bookingId: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, "bookings", bookingId), { ...data, updatedAt: serverTimestamp() });
}
export async function getBookingsForProOnDate(proId: string, date: string) {
  const q = query(collection(db, "bookings"), where("proId", "==", proId), where("date", "==", date));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

// upload booking attachment
export async function uploadBookingAttachment(bookingId: string | null, file: File) {
  validateUpload(file, "bookingAttachment"); // throws if invalid
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary missing");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  const resourceType = file.type.startsWith("image/") ? "image" : "raw";
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  const fileUrl = data.secure_url;

  if (bookingId) {
    await updateDoc(doc(db, "bookings", bookingId), { attachmentUrl: fileUrl, attachmentName: file.name, attachmentType: file.type });
  }

  return { url: fileUrl, name: file.name, type: file.type };
}

/* ═══════════════════════════════════════════
   AVAILABILITY
═══════════════════════════════════════════ */
export async function getProAvailability(proId: string) {
  const snap = await getDoc(doc(db, "proAvailability", proId));
  if (snap.exists()) return normalizeAvailabilityData(snap.data() as Record<string, unknown>);
  return null;
}

export async function updateProAvailability(proId: string, availabilityData: Record<string, unknown>) {
  await setDoc(doc(db, "proAvailability", proId), { ...availabilityData, updatedAt: serverTimestamp() }, { merge: true });
}

/* ═══════════════════════════════════════════
   REVIEWS
═══════════════════════════════════════════ */
export async function addReview(bookingId: string, proId: string, rating: number, comment: string) {
  if (!auth.currentUser) throw new Error("Must be logged in to review");
  // 1. Add review
  await addDoc(collection(db, "reviews"), {
    bookingId,
    proId,
    clientId: auth.currentUser.uid,
    clientName: auth.currentUser.displayName || "User",
    clientPhoto: auth.currentUser.photoURL || "",
    rating,
    comment,
    createdAt: serverTimestamp()
  });

  // Spam flagging is handled server-side by a Cloud Function trigger.
  await recalculateProRating(proId);
}
export async function getReviewsForUser(proId: string) {
  const q = query(collection(db, "reviews"), where("proId", "==", proId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}
export async function recalculateProRating(proId: string) {
  const allReviews = await getReviewsForUser(proId);
  const avg = allReviews.length > 0 ? allReviews.reduce((s, r) => s + ((r.rating as number) || 0), 0) / allReviews.length : 0;
  const update = { rating: Math.round(avg * 10) / 10, reviewCount: allReviews.length };
  await updateDoc(doc(db, "users", proId), update);
  await mirrorPublicProfile(proId, update);
}
export async function checkSpamReviews(proId: string) {
  // Deprecated: automated spam checks run in Cloud Functions.
  // Kept as a no-op for backward compatibility with older imports.
  void proId;
}
export async function reportProfessional(proId: string, reason: string, comment: string) {
  if (!auth.currentUser) throw new Error("Must be logged in to report");
  await addDoc(collection(db, "reports"), {
    proId,
    reporterId: auth.currentUser.uid,
    reason,
    comment,
    status: "pending",
    createdAt: serverTimestamp()
  });
}

/* ═══════════════════════════════════════════
   SOCIETIES
═══════════════════════════════════════════ */
export async function createSociety(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "societies"), { ...data, memberCount: 0, subscription: "free", createdAt: serverTimestamp() });
  return ref.id;
}
export async function getAllSocieties(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: any[] = [orderBy("name"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "societies"), ...(constraints as any[])));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}
export async function updateSociety(id: string, data: Record<string, unknown>) { await updateDoc(doc(db, "societies", id), data); }
export async function deleteSociety(id: string) { await deleteDoc(doc(db, "societies", id)); }

/* ═══════════════════════════════════════════
   TRANSACTIONS
═══════════════════════════════════════════ */
export async function recordTransaction(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "transactions"), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}
export async function getTransactions(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: any[] = [orderBy("createdAt", "desc"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "transactions"), ...(constraints as any[])));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}
export async function getTransactionsForPro(proId: string) {
  const q = query(collection(db, "transactions"), where("proId", "==", proId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

/* ═══════════════════════════════════════════
   MESSAGES
═══════════════════════════════════════════ */
/**
 * Returns a deterministic conversation ID for a pair of users (sorted UIDs joined by '_').
 * This is idempotent and eliminates duplicate conversation documents.
 */
export function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join("_");
}

export async function getOrCreateConversation(uid1: string, uid2: string) {
  const convId = getConversationId(uid1, uid2);
  const convRef = doc(db, "messages", convId);
  const [p1, p2] = await Promise.all([getPublicProfile(uid1), getPublicProfile(uid2)]);

  const participantNames: Record<string, string> = {
    [uid1]: (p1?.displayName as string) || "User",
    [uid2]: (p2?.displayName as string) || "User",
  };
  const participantPhotos: Record<string, string> = {
    [uid1]: (p1?.photoURL as string) || "",
    [uid2]: (p2?.photoURL as string) || "",
  };

  await runTransaction(db, async tx => {
    const snap = await tx.get(convRef);
    if (!snap.exists()) {
      tx.set(convRef, {
        participants: [uid1, uid2].sort(),
        participantNames,
        participantPhotos,
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });
    }
  });
  return convId;
}
export async function sendMessage(conversationId: string, senderId: string, text: string, attachment?: { url: string; type: string; name: string }) {
  const payload: Record<string, unknown> = { senderId, text, timestamp: serverTimestamp(), read: false };
  if (attachment) {
    payload.attachmentUrl = attachment.url;
    payload.attachmentType = attachment.type;
    payload.attachmentName = attachment.name;
  }
  const lastMsg = attachment ? (text ? `📎 ${text}` : `📎 Attachment`) : text;
  const senderDisplayName = auth.currentUser?.displayName || "User";
  const senderPhotoURL = auth.currentUser?.photoURL || "";

  await runTransaction(db, async tx => {
    const chatRef = doc(collection(db, `messages/${conversationId}/chats`));
    const convRef = doc(db, "messages", conversationId);

    tx.set(chatRef, payload);
    // Merge keeps this safe even if conversation metadata is partially missing.
    tx.set(convRef, {
      lastMessage: lastMsg,
      lastMessageAt: serverTimestamp(),
      lastSenderId: senderId,
      [`participantNames.${senderId}`]: senderDisplayName,
      [`participantPhotos.${senderId}`]: senderPhotoURL,
    }, { merge: true });
  });
}

export async function uploadAttachment(conversationId: string, file: File) {
  validateUpload(file, "chatAttachment"); // throws if invalid
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary configuration is missing.");
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", `ProNeighbor/messages/${conversationId}`);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: formData });
  if (!response.ok) { const err = await response.json(); throw new Error(err.error?.message || "Upload failed"); }
  const data = await response.json();
  return { url: data.secure_url as string, resourceType: data.resource_type as string, format: data.format as string, originalFilename: data.original_filename as string };
}
export function subscribeToMessages(conversationId: string, callback: (messages: Record<string, unknown>[]) => void): Unsubscribe {
  const q = query(collection(db, `messages/${conversationId}/chats`), orderBy("timestamp", "asc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export function subscribeToConversations(uid: string, callback: (convos: Record<string, unknown>[]) => void): Unsubscribe {
  const q = query(collection(db, "messages"), where("participants", "array-contains", uid), orderBy("lastMessageAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
export function formatTimestamp(ts: unknown): string {
  if (!ts) return "";
  if (ts instanceof Timestamp) return ts.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return "";
}
export function formatTimestampTime(ts: unknown): string {
  if (!ts) return "";
  if (ts instanceof Timestamp) return ts.toDate().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return "";
}

/* ═══════════════════════════════════════════
   LOCAL FEED
═══════════════════════════════════════════ */
export async function createFeedPost(data: {
  authorId: string; authorName: string; content: string; locality?: string; tower?: string;
}) {
  const ref = await addDoc(collection(db, "localFeed"), { ...data, createdAt: serverTimestamp(), likes: 0 });
  return ref.id;
}

export function subscribeToFeed(
  locality: string | undefined,
  callback: (posts: Record<string, unknown>[]) => void
): Unsubscribe {
  const q = locality
    ? query(collection(db, "localFeed"), where("locality", "==", locality), orderBy("createdAt", "desc"), limit(30))
    : query(collection(db, "localFeed"), orderBy("createdAt", "desc"), limit(30));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function deleteFeedPost(postId: string) {
  await deleteDoc(doc(db, "localFeed", postId));
}

export type FeedReportReason = "offensive" | "scam" | "spam" | "policy_violation" | "other";

export async function reportFeedPost(
  postId: string,
  reporterId: string,
  reason: FeedReportReason,
  details?: string,
): Promise<{ success: boolean; alreadyReported?: boolean }> {
  // Dedup: one report per user per post
  const dedupId = `${postId}_${reporterId}`;
  const dedupRef = doc(db, "feedReports", dedupId);
  const existing = await getDoc(dedupRef);
  if (existing.exists()) return { success: false, alreadyReported: true };

  await setDoc(dedupRef, {
    postId,
    reporterId,
    reason,
    details: details ?? "",
    status: "pending",
    createdAt: serverTimestamp(),
  });

  // Increment report count on the post; auto-hide after 3 reports
  const postRef = doc(db, "localFeed", postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const currentCount = ((postSnap.data()?.reportCount as number) ?? 0) + 1;
    await updateDoc(postRef, {
      reportCount: currentCount,
      ...(currentCount >= 3 ? { hidden: true } : {}),
    });
  }
  return { success: true };
}

/** Toggle a reaction (❤️ or 👍) on a feed post. */
export async function toggleReactionToFeedPost(postId: string, uid: string, type: "heart" | "thumb") {
  const postRef = doc(db, "localFeed", postId);

  await runTransaction(db, async tx => {
    const postSnap = await tx.get(postRef);
    if (!postSnap.exists()) return;

    const data = postSnap.data();
    const reactions = (data.reactions as Record<string, string>) || {};
    const likes = Array.isArray(data.likes) ? (data.likes as string[]) : [];

    const existing = reactions[uid];
    if (existing === type) {
      // Remove it if same type clicked (toggle off)
      delete reactions[uid];
      const index = likes.indexOf(uid);
      if (index !== -1) likes.splice(index, 1);
    } else {
      // Add or replace
      reactions[uid] = type;
      if (!likes.includes(uid)) likes.push(uid);
    }

    tx.update(postRef, {
      reactions,
      likes,
      likeCount: likes.length,
      updatedAt: serverTimestamp()
    });
  });
}

/* ═══════════════════════════════════════════
   RECENTLY VIEWED / RECOMMENDATIONS
═══════════════════════════════════════════ */
export async function trackProView(uid: string, proId: string) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;
  const existing: string[] = (snap.data().recentlyViewedPros as string[]) || [];
  const updated = [proId, ...existing.filter(id => id !== proId)].slice(0, 10);
  await updateDoc(userRef, { recentlyViewedPros: updated, updatedAt: serverTimestamp() });
}

export async function getRecommendedPros(
  uid: string, limit_: number = 4
): Promise<Record<string, unknown>[]> {
  // Reads from /publicProfiles — safe, no sensitive data exposure.
  const q = query(
    collection(db, "publicProfiles"),
    where("isServiceProvider", "==", true),
    orderBy("reviewCount", "desc"),
    limit(limit_ * 5)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(p => (p.uid as string) !== uid)
    .slice(0, limit_);
}

export async function getLastBookedPro(uid: string): Promise<string | null> {
  const lastBooking = await getLastCompletedBookingForUser(uid);
  return (lastBooking?.proId as string) || null;
}

/* ═══════════════════════════════════════════
   MESSAGING — READ RECEIPTS & UNREAD COUNT
═══════════════════════════════════════════ */
/** Mark a conversation as read for a given user by updating lastReadAt. */
export async function markConversationRead(convId: string, uid: string) {
  await updateDoc(doc(db, "messages", convId), {
    [`lastReadAt.${uid}`]: serverTimestamp(),
  });
}

/** Return count of unread messages in a conversation for a given user since lastReadAt. */
export async function getUnreadCount(convId: string, uid: string): Promise<number> {
  const convSnap = await getDoc(doc(db, "messages", convId));
  if (!convSnap.exists()) return 0;
  const lastRead = convSnap.data()?.lastReadAt?.[uid] as Timestamp | undefined;
  if (!lastRead) {
    // Never read — count all messages not sent by self
    const q = query(
      collection(db, `messages/${convId}/chats`),
      where("senderId", "!=", uid)
    );
    const snap = await getDocs(q);
    return snap.size;
  }
  const q = query(
    collection(db, `messages/${convId}/chats`),
    where("senderId", "!=", uid),
    where("timestamp", ">", lastRead)
  );
  const snap = await getDocs(q);
  return snap.size;
}


/* ═══════════════════════════════════════════
   PLATFORM STATS (Public)
   ═══════════════════════════════════════════ */
/**
 * Fetches aggregate platform stats for the social proof ticker.
 * This is safe to call from any component as it doesn't return raw documents.
 */
export async function getPublicStats() {
  try {
    const [usersAgg, prosAgg, activeBookingsAgg, societiesSnap] = await Promise.all([
      getCountFromServer(collection(db, "publicProfiles")),
      getCountFromServer(query(collection(db, "publicProfiles"), where("isServiceProvider", "==", true))),
      getCountFromServer(query(collection(db, "bookings"), where("status", "in", ["pending", "confirmed"]))),
      getDocs(query(collection(db, "societies"), limit(500))),
    ]);

    const localityCount = new Set(
      societiesSnap.docs
        .map(d => ((d.data()?.city as string) || "").trim().toLowerCase())
        .filter(Boolean)
    ).size;

    return {
      totalUsers: usersAgg.data().count || 0,
      totalPros: prosAgg.data().count || 0,
      activeBookings: activeBookingsAgg.data().count || 0,
      localityCount,
    };
  } catch {
    return {
      totalUsers: 0,
      totalPros: 0,
      activeBookings: 0,
      localityCount: 0,
    };
  }
}
