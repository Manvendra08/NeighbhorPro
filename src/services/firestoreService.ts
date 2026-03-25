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
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "../firebase";
import { generateReferralCode } from "./coinService";
import { validateUpload } from "../utils/cloudinary";

/* ═══════════════════════════════════════════
   USERS
═══════════════════════════════════════════ */
export async function getUserProfile(uid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
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
  return photoURL;
}

export async function uploadResidencyProof(uid: string, file: File) {
  validateUpload(file, "residencyProof"); // throws if invalid
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing. Please contact support.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "ProNeighbor/residency-proofs");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: formData });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Cloudinary upload failed");
  }
  const data = await response.json();
  const residencyProofUrl = data.secure_url;

  await updateDoc(doc(db, "users", uid), {
    residencyProofUrl,
    residentVerificationStatus: "pending",
    updatedAt: serverTimestamp(),
  });
  return residencyProofUrl;
}

export async function updateResidentVerification(
  uid: string,
  status: "none" | "pending" | "verified",
  method: "manual" | "auto" | null
) {
  await updateDoc(doc(db, "users", uid), {
    residentVerificationStatus: status,
    verificationMethod: method,
    updatedAt: serverTimestamp(),
  });
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
  const constraints: Parameters<typeof query>[1][] = [orderBy("createdAt", "desc"), limit(BROWSE_PAGE_SIZE)];
  if (filters?.locality) constraints.unshift(where("locality", "==", filters.locality));
  if (filters?.tower) constraints.unshift(where("tower", "==", filters.tower));
  if (cursor) constraints.push(startAfter(cursor));

  const q = query(collection(db, "users"), ...constraints);
  const snap = await getDocs(q);
  const data = snap.docs.map(d => ({ uid: d.id, ...d.data() } as Record<string, unknown>));
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
  const q = query(collection(db, "bookings"), where("proId", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
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
  if (snap.exists()) return snap.data() as Record<string, unknown>;
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

  // 2. Check spam and recalculate
  await checkSpamReviews(proId);
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
  await updateDoc(doc(db, "users", proId), { rating: Math.round(avg * 10) / 10, reviewCount: allReviews.length });
}
export async function checkSpamReviews(proId: string) {
  const q = query(collection(db, "reviews"), where("proId", "==", proId), orderBy("createdAt", "desc"), limit(3));
  const snap = await getDocs(q);
  if (snap.size < 3) return;

  let allOneStar = true;
  snap.forEach(doc => {
    if (doc.data().rating > 1) allOneStar = false;
  });

  if (allOneStar) {
    await addDoc(collection(db, "reports"), {
      proId,
      reason: "Automated Spam Flag",
      comment: "3 consecutive 1-star reviews detected rapidly.",
      reporterId: "system",
      status: "pending",
      createdAt: serverTimestamp()
    });
  }
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
  await runTransaction(db, async tx => {
    const snap = await tx.get(convRef);
    if (!snap.exists()) {
      tx.set(convRef, {
        participants: [uid1, uid2].sort(),
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
  await addDoc(collection(db, `messages/${conversationId}/chats`), payload);

  const lastMsg = attachment ? (text ? `📎 ${text}` : `📎 Attachment`) : text;
  await updateDoc(doc(db, "messages", conversationId), { lastMessage: lastMsg, lastMessageAt: serverTimestamp() });
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
  // Fetch 20 most-reviewed pros as recommendation baseline
  const q = query(
    collection(db, "users"),
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
  const q = query(
    collection(db, "bookings"),
    where("clientId", "==", uid),
    where("status", "in", ["completed", "reviewed"]),
    orderBy("createdAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return (snap.docs[0].data().proId as string) || null;
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


