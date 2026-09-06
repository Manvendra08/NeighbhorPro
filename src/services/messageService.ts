import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
  Timestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import { validateUpload } from "../utils/cloudinary";
import { uploadToCloudinary } from "./_shared";
import { getPublicProfile } from "./userService";
import { getBookingById } from "./bookingService";

export function getConversationId(uid1: string, uid2: string, bookingId?: string): string {
  const baseId = [uid1, uid2].sort().join("_");
  return bookingId ? `${baseId}__booking__${bookingId}` : baseId;
}

export function getConversationBookingId(conversationId: string): string | null {
  const marker = "__booking__";
  const markerIndex = conversationId.indexOf(marker);
  if (markerIndex < 0) return null;
  const bookingId = conversationId.slice(markerIndex + marker.length).trim();
  return bookingId || null;
}

type ConversationOptions = {
  bookingId?: string;
  allowUnlinked?: boolean;
};

function bookingHasUsers(
  booking: Record<string, unknown>, uid1: string, uid2: string
): boolean {
  const participants = new Set<string>([
    booking.clientId as string,
    booking.clientUid as string,
    booking.proId as string,
    booking.proUid as string,
  ].filter(Boolean));
  return participants.has(uid1) && participants.has(uid2);
}

export async function getOrCreateConversation(
  uid1: string, uid2: string, options?: ConversationOptions
) {
  const bookingId = options?.bookingId;
  const convId = getConversationId(uid1, uid2, bookingId);
  const convRef = doc(db, "messages", convId);
  const allowUnlinked = options?.allowUnlinked === true;

  if (!allowUnlinked) {
    if (!bookingId) throw new Error("BOOKING_REQUIRED");
    const booking = await getBookingById(bookingId);
    if (!booking || !bookingHasUsers(booking, uid1, uid2)) throw new Error("INVALID_BOOKING_PARTICIPANTS");
    if ((booking.status as string) === "cancelled") throw new Error("BOOKING_CANCELLED");
  }

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
        bookingId: bookingId || null,
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });
    } else if (bookingId && !(snap.data().bookingId as string | undefined)) {
      tx.update(convRef, { bookingId, participantNames, participantPhotos });
    }
  });
  return convId;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  text: string,
  attachment?: { url: string; type: string; name: string }
) {
  const payload: Record<string, unknown> = { senderId, text, timestamp: serverTimestamp(), read: false };
  if (attachment) {
    payload.attachmentUrl = attachment.url;
    payload.attachmentType = attachment.type;
    payload.attachmentName = attachment.name;
  }
  const lastMsg = attachment ? (text ? `📎 ${text}` : `📎 Attachment`) : text;

  await runTransaction(db, async tx => {
    const chatRef = doc(collection(db, `messages/${conversationId}/chats`));
    const convRef = doc(db, "messages", conversationId);
    tx.set(chatRef, payload);
    tx.set(convRef, {
      lastMessage: lastMsg,
      lastMessageAt: serverTimestamp(),
      lastSenderId: senderId,
    }, { merge: true });
  });
}

export async function uploadAttachment(conversationId: string, file: File) {
  validateUpload(file, "chatAttachment");
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary configuration is missing.");
  const data = await uploadToCloudinary(
    file, `ProNeighbor/messages/${conversationId}`, uploadPreset, cloudName, "auto"
  );
  return {
    url: data.secure_url as string,
    resourceType: data.resource_type as string,
    format: data.format as string,
    originalFilename: data.original_filename as string,
  };
}

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: Record<string, unknown>[]) => void
): Unsubscribe {
  const q = query(
    collection(db, `messages/${conversationId}/chats`),
    orderBy("timestamp", "asc")
  );
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
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
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export async function markConversationRead(convId: string, uid: string) {
  await updateDoc(doc(db, "messages", convId), {
    [`lastReadAt.${uid}`]: serverTimestamp(),
  });
}

export async function getUnreadCount(convId: string, uid: string): Promise<number> {
  const convSnap = await getDoc(doc(db, "messages", convId));
  if (!convSnap.exists()) return 0;
  const lastRead = convSnap.data()?.lastReadAt?.[uid] as Timestamp | undefined;
  if (!lastRead) {
    const snap = await getDocs(
      query(collection(db, `messages/${convId}/chats`), where("senderId", "!=", uid), limit(100))
    );
    return snap.size;
  }
  const snap = await getDocs(
    query(
      collection(db, `messages/${convId}/chats`),
      where("senderId", "!=", uid),
      where("timestamp", ">", lastRead),
      limit(100)
    )
  );
  return snap.size;
}
