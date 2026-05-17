import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  Query,
  QueryConstraint,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from "firebase/firestore";
import { auth } from "../firebase";
import { db } from "../firebase";
import { validateUpload } from "../utils/cloudinary";
import { safeGetDocs, mergeAndSortByCreatedAt, uploadToCloudinary } from "./_shared";

export async function createBooking(data: Record<string, unknown>) {
  const bookingPayload = { ...data };
  const clientId = (bookingPayload.clientId as string) || (bookingPayload.clientUid as string) || "";
  const proId = (bookingPayload.proId as string) || (bookingPayload.proUid as string) || "";
  const amount = Math.max(0, Math.trunc(Number(bookingPayload.amount ?? 0) || 0));
  const notesValue = typeof bookingPayload.notes === "string" ? bookingPayload.notes : "";
  if (notesValue.length > 500) throw new Error("NOTES_TOO_LONG");
  const explicitEscrowCoins = Math.max(0, Math.trunc(Number(bookingPayload.escrowCoins ?? 0) || 0));
  const escrowCoins = explicitEscrowCoins > 0 ? explicitEscrowCoins : amount;

  if (!clientId || !proId) throw new Error("BOOKING_PARTICIPANTS_REQUIRED");
  if (clientId === proId) throw new Error("SELF_BOOKING_NOT_ALLOWED");

  bookingPayload.clientId = clientId;
  bookingPayload.clientUid = clientId;
  bookingPayload.proId = proId;
  bookingPayload.proUid = proId;

  const bookingRef = doc(collection(db, "bookings"));
  const now = serverTimestamp();
  const isPaid = escrowCoins > 0;
  const bookingDoc = {
    ...bookingPayload,
    amount,
    isPaid,
    coinsPaid: isPaid,
    escrowCoins,
    escrowStatus: isPaid ? "held" : "none",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await runTransaction(db, async tx => {
    if (escrowCoins > 0) {
      const userRef = doc(db, "users", clientId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");
      const balance = Math.max(0, Math.trunc(Number(userSnap.data()?.coinBalance ?? 0) || 0));
      if (balance < escrowCoins) throw new Error("INSUFFICIENT_BALANCE");
      const newBal = balance - escrowCoins;
      const ledgerEntryId = `${bookingRef.id}_hold_${clientId}`;
      tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerEntryId });
      tx.set(bookingRef, bookingDoc);
      tx.set(doc(collection(db, "coinLedger", clientId, "entries"), ledgerEntryId), {
        uid: clientId,
        type: "booking_escrow",
        amount: -escrowCoins,
        balanceAfter: newBal,
        description: `Payment held: ${(bookingPayload.serviceName as string) || "Booking"}`,
        refId: bookingRef.id,
        createdAt: serverTimestamp(),
      });
      return;
    }
    tx.set(bookingRef, bookingDoc);
  });
  return bookingRef.id;
}

export async function updateBookingStatus(bookingId: string, status: string) {
  const validStatuses = ["confirmed", "cancelled", "completed", "reviewed"];
  if (!validStatuses.includes(status)) throw new Error("INVALID_BOOKING_STATUS");
  await runTransaction(db, async tx => {
    const ref = doc(db, "bookings", bookingId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("BOOKING_NOT_FOUND");
    const currentStatus = String(snap.data()?.status ?? "");
    const currentUserId = auth.currentUser?.uid ?? null;
    const bookingData = snap.data() as Record<string, unknown>;
    const clientId = String(bookingData.clientId || bookingData.clientUid || "");
    const proId = String(bookingData.proId || bookingData.proUid || "");
    const update: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
    switch (status) {
      case "confirmed":
        if (currentStatus !== "pending") throw new Error("INVALID_BOOKING_TRANSITION");
        if (currentUserId !== proId) throw new Error("ONLY_PRO_CAN_CONFIRM");
        update.confirmedAt = serverTimestamp();
        update.confirmedBy = currentUserId;
        break;
      case "cancelled":
        if (currentStatus !== "pending" && currentStatus !== "confirmed") {
          throw new Error("INVALID_BOOKING_TRANSITION");
        }
        if (currentUserId !== clientId && currentUserId !== proId) {
          throw new Error("ONLY_PARTICIPANT_CAN_CANCEL");
        }
        update.cancelledAt = serverTimestamp();
        update.cancelledBy = currentUserId;
        break;
      case "completed":
        if (currentStatus !== "confirmed") throw new Error("INVALID_BOOKING_TRANSITION");
        if (currentUserId !== proId) throw new Error("ONLY_PRO_CAN_COMPLETE");
        update.completedAt = serverTimestamp();
        update.completedBy = currentUserId;
        break;
      case "reviewed":
        if (currentStatus !== "completed") throw new Error("INVALID_BOOKING_TRANSITION");
        if (currentUserId !== clientId) throw new Error("ONLY_CLIENT_CAN_MARK_REVIEWED");
        update.reviewedAt = serverTimestamp();
        update.reviewedBy = currentUserId;
        break;
    }
    tx.update(ref, update);
  });
}

export async function getBookingsForUser(uid: string) {
  const [primaryDocs, legacyDocs] = await Promise.all([
    safeGetDocs(query(collection(db, "bookings"), where("clientUid", "==", uid), orderBy("createdAt", "desc"))),
    safeGetDocs(query(collection(db, "bookings"), where("clientId", "==", uid), orderBy("createdAt", "desc"))),
  ]);
  return mergeAndSortByCreatedAt([...primaryDocs, ...legacyDocs]);
}

export async function getBookingsForPro(uid: string) {
  const [primaryDocs, legacyDocs] = await Promise.all([
    safeGetDocs(query(collection(db, "bookings"), where("proUid", "==", uid), orderBy("createdAt", "desc"))),
    safeGetDocs(query(collection(db, "bookings"), where("proId", "==", uid), orderBy("createdAt", "desc"))),
  ]);
  return mergeAndSortByCreatedAt([...primaryDocs, ...legacyDocs]);
}

export async function getAllBookings(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "bookings"), ...constraints));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}

export async function getBookingById(bookingId: string) {
  const snap = await getDoc(doc(db, "bookings", bookingId));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Record<string, unknown> : null;
}

export async function getLatestBookingBetweenUsers(
  uid1: string, uid2: string
): Promise<Record<string, unknown> | null> {
  const buildPairQueries = (clientUid: string, proUid: string): Query<DocumentData>[] => [
    query(collection(db, "bookings"), where("clientUid", "==", clientUid), where("proUid", "==", proUid), orderBy("createdAt", "desc"), limit(1)),
    query(collection(db, "bookings"), where("clientId", "==", clientUid), where("proId", "==", proUid), orderBy("createdAt", "desc"), limit(1)),
    query(collection(db, "bookings"), where("clientUid", "==", clientUid), where("proId", "==", proUid), orderBy("createdAt", "desc"), limit(1)),
    query(collection(db, "bookings"), where("clientId", "==", clientUid), where("proUid", "==", proUid), orderBy("createdAt", "desc"), limit(1)),
  ];
  const allQueries = [...buildPairQueries(uid1, uid2), ...buildPairQueries(uid2, uid1)];
  const docsByQuery = await Promise.all(allQueries.map(q => safeGetDocs(q)));
  const candidates = docsByQuery.flat();
  if (!candidates.length) return null;
  const latest = candidates.sort((a, b) => {
    const aSec = (a.data()?.createdAt as Timestamp | undefined)?.seconds ?? 0;
    const bSec = (b.data()?.createdAt as Timestamp | undefined)?.seconds ?? 0;
    return bSec - aSec;
  })[0];
  return { id: latest.id, ...latest.data() } as Record<string, unknown>;
}

export async function getLastCompletedBookingForUser(uid: string) {
  const [currentDocs, legacyDocs] = await Promise.all([
    safeGetDocs(query(collection(db, "bookings"), where("clientUid", "==", uid), where("status", "in", ["completed", "reviewed"]), orderBy("createdAt", "desc"), limit(1))),
    safeGetDocs(query(collection(db, "bookings"), where("clientId", "==", uid), where("status", "in", ["completed", "reviewed"]), orderBy("createdAt", "desc"), limit(1))),
  ]);
  const sorted = mergeAndSortByCreatedAt([...currentDocs, ...legacyDocs]);
  return sorted[0] ?? null;
}

export async function updateBookingFields(bookingId: string, data: Record<string, unknown>) {
  const allowedKeys = new Set(["cancellationComment", "cancellationCommentBy", "cancellationCommentRole"]);
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) {
      throw new Error("Unsupported booking field update.");
    }
  }
  await updateDoc(doc(db, "bookings", bookingId), { ...data, updatedAt: serverTimestamp() });
}

export async function getBookingsForProOnDate(proId: string, date: string) {
  const [currentDocs, legacyDocs] = await Promise.all([
    safeGetDocs(query(collection(db, "bookings"), where("proUid", "==", proId), where("date", "==", date))),
    safeGetDocs(query(collection(db, "bookings"), where("proId", "==", proId), where("date", "==", date))),
  ]);
  return mergeAndSortByCreatedAt([...currentDocs, ...legacyDocs]);
}

export async function uploadBookingAttachment(bookingId: string | null, file: File) {
  validateUpload(file, "bookingAttachment");
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary missing");
  const data = await uploadToCloudinary(file, "ProNeighbor/bookings", uploadPreset, cloudName, "auto");
  const fileUrl = data.secure_url;
  if (bookingId) {
    await updateDoc(doc(db, "bookings", bookingId), { attachmentUrl: fileUrl, attachmentName: file.name, attachmentType: file.type });
  }
  return { url: fileUrl, name: file.name, type: file.type };
}

/**
 * Cancels a booking and refunds escrow coins to the client.
 * Status must be pending or confirmed to cancel.
 */
export async function cancelBookingAndRefund(bookingId: string): Promise<void> {
  await runTransaction(db, async tx => {
    const bookingRef = doc(db, "bookings", bookingId);
    const snap = await tx.get(bookingRef);
    if (!snap.exists()) throw new Error("BOOKING_NOT_FOUND");
    const booking = snap.data() as Record<string, unknown>;
    const currentStatus = String(booking.status ?? "");
    if (!["pending", "confirmed"].includes(currentStatus)) {
      throw new Error("BOOKING_CANNOT_BE_CANCELLED");
    }
    const escrowCoins = Math.max(0, Math.trunc(Number(booking.escrowCoins ?? 0) || 0));
    const clientId = String(booking.clientId || booking.clientUid || "");
    const escrowStatus = String(booking.escrowStatus ?? "");
    const update: Record<string, unknown> = {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      cancelledBy: auth.currentUser?.uid ?? null,
      updatedAt: serverTimestamp(),
    };
    if (escrowCoins > 0 && escrowStatus === "held" && clientId) {
      const userRef = doc(db, "users", clientId);
      const userSnap = await tx.get(userRef);
      if (userSnap.exists()) {
        const currentBalance = Math.max(0, Math.trunc(Number(userSnap.data()?.coinBalance ?? 0) || 0));
        const newBalance = currentBalance + escrowCoins;
        const ledgerEntryId = `${bookingId}_refund_${clientId}`;
        tx.update(userRef, { coinBalance: newBalance, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerEntryId });
        tx.set(doc(collection(db, "coinLedger", clientId, "entries"), ledgerEntryId), {
          uid: clientId,
          type: "booking_refund",
          amount: escrowCoins,
          balanceAfter: newBalance,
          description: `Refund: ${String(booking.serviceName || "Booking")}`,
          refId: bookingId,
          createdAt: serverTimestamp(),
        });
        update.escrowStatus = "refunded";
      }
    }
    tx.update(bookingRef, update);
  });
}

export async function getLastBookedPro(uid: string): Promise<string | null> {
  const lastBooking = await getLastCompletedBookingForUser(uid);
  return (lastBooking?.proId as string) || null;
}
