import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "../firebase";

/* ═══════════════════════════════════════════
   USERS
═══════════════════════════════════════════ */
export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserProfile(uid: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
}

export async function uploadProfilePhoto(uid: string, file: File) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration is missing. Please check your .env.local file.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "neighborpro/profiles");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Failed to upload image to Cloudinary");
  }

  const data = await response.json();
  const photoURL = data.secure_url;

  // Update in auth
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { photoURL });
  }

  // Update in firestore
  await updateDoc(doc(db, "users", uid), { photoURL, updatedAt: serverTimestamp() });
  
  return photoURL;
}

export async function listProfessionals(categoryFilter?: string) {
  let q;
  if (categoryFilter && categoryFilter !== "All") {
    q = query(
      collection(db, "users"),
      where("skills", "array-contains", categoryFilter),
      orderBy("rating", "desc"),
      limit(50)
    );
  } else {
    q = query(collection(db, "users"), orderBy("rating", "desc"), limit(50));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function getAllUsers() {
  const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => d.data());
}

/* ═══════════════════════════════════════════
   SERVICES
═══════════════════════════════════════════ */
export async function createService(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "services"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getServicesByUser(userId: string) {
  const q = query(collection(db, "services"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

export async function getAllServices() {
  const snap = await getDocs(query(collection(db, "services"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

export async function deleteService(id: string) {
  await deleteDoc(doc(db, "services", id));
}

/* ═══════════════════════════════════════════
   BOOKINGS
═══════════════════════════════════════════ */
export async function createBooking(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "bookings"), {
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBookingStatus(bookingId: string, status: string) {
  await updateDoc(doc(db, "bookings", bookingId), { status, updatedAt: serverTimestamp() });
}

export async function getBookingsForUser(uid: string) {
  const q = query(collection(db, "bookings"), where("clientId", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

export async function getBookingsForPro(uid: string) {
  const q = query(collection(db, "bookings"), where("proId", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

export async function getAllBookings() {
  const snap = await getDocs(query(collection(db, "bookings"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

/* ═══════════════════════════════════════════
   REVIEWS
═══════════════════════════════════════════ */
export async function addReview(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "reviews"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  // Also update the pro's rating
  const proId = data.proId as string;
  const allReviews = await getReviewsForUser(proId);
  const totalRating = allReviews.reduce((sum, r) => sum + ((r.rating as number) || 0), 0);
  const avgRating = allReviews.length > 0 ? totalRating / allReviews.length : 0;
  await updateDoc(doc(db, "users", proId), {
    rating: Math.round(avgRating * 10) / 10,
    reviewCount: allReviews.length,
  });
  return ref.id;
}

export async function getReviewsForUser(proId: string) {
  const q = query(collection(db, "reviews"), where("proId", "==", proId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

/* ═══════════════════════════════════════════
   SOCIETIES
═══════════════════════════════════════════ */
export async function createSociety(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "societies"), {
    ...data,
    memberCount: 0,
    subscription: "free",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getAllSocieties() {
  const snap = await getDocs(query(collection(db, "societies"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

export async function updateSociety(id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, "societies", id), data);
}

export async function deleteSociety(id: string) {
  await deleteDoc(doc(db, "societies", id));
}

/* ═══════════════════════════════════════════
   TRANSACTIONS
═══════════════════════════════════════════ */
export async function recordTransaction(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "transactions"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTransactions() {
  const snap = await getDocs(query(collection(db, "transactions"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

export async function getTransactionsForPro(proId: string) {
  const q = query(
    collection(db, "transactions"),
    where("proId", "==", proId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
}

/* ═══════════════════════════════════════════
   MESSAGES (real-time)
═══════════════════════════════════════════ */
export async function getOrCreateConversation(uid1: string, uid2: string) {
  // Check if conversation already exists
  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", uid1)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const participants = d.data().participants as string[];
    if (participants.includes(uid2)) {
      return d.id;
    }
  }
  // Create new conversation
  const ref = await addDoc(collection(db, "messages"), {
    participants: [uid1, uid2],
    lastMessage: "",
    lastMessageAt: serverTimestamp(),
  });
  return ref.id;
}

export async function sendMessage(conversationId: string, senderId: string, text: string) {
  await addDoc(collection(db, `messages/${conversationId}/chats`), {
    senderId,
    text,
    timestamp: serverTimestamp(),
    read: false,
  });
  await updateDoc(doc(db, "messages", conversationId), {
    lastMessage: text,
    lastMessageAt: serverTimestamp(),
  });
}

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Record<string, unknown>[]) => void
): Unsubscribe {
  const q = query(
    collection(db, `messages/${conversationId}/chats`),
    orderBy("timestamp", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeToConversations(
  uid: string,
  callback: (convos: Record<string, unknown>[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", uid),
    orderBy("lastMessageAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
export function formatTimestamp(ts: unknown): string {
  if (!ts) return "";
  if (ts instanceof Timestamp) {
    return ts.toDate().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return "";
}

export function formatTimestampTime(ts: unknown): string {
  if (!ts) return "";
  if (ts instanceof Timestamp) {
    return ts.toDate().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "";
}
