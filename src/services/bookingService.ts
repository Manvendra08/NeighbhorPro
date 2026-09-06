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
import { logActivity } from "./activityService";

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
      // [Bug #1 FIX v2] Deduct from cashable first, overflow to promo.
      // Maintains invariant: coinBalance = cashableBalance + promoBalance
      const cashableBal = Math.max(0, Math.trunc(Number(userSnap.data()?.cashableBalance ?? 0) || 0));
      const promoBal = Math.max(0, Math.trunc(Number(userSnap.data()?.promoBalance ?? 0) || 0));
      const cashableDeduction = Math.min(cashableBal, escrowCoins);
      const promoDeduction = escrowCoins - cashableDeduction;
      const newCashable = cashableBal - cashableDeduction;
      const newPromo = promoBal - promoDeduction;
      
      // [Bug #1 FIX v3] MUST update promoBalance to maintain invariant:
      // coinBalance === cashableBalance + promoBalance
      // Without this, promoBalance drifts out of sync when escrow overflows to promo.
      const ledgerEntryId = `${bookingRef.id}_create_hold_${clientId}`;
      tx.update(userRef, { 
        coinBalance: newBal, 
        cashableBalance: newCashable, 
        promoBalance: newPromo, 
        updatedAt: serverTimestamp(), 
        lastLedgerEntryId: ledgerEntryId 
      });
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
    } else {
      tx.set(bookingRef, bookingDoc);
    }
  });
  return bookingRef.id;
}

export async function updateBookingStatus(
  bookingId: string,
  status: string,
  authorizedUid?: string
) {
  const validStatuses = ["confirmed", "cancelled", "completed", "reviewed"];
  if (!validStatuses.includes(status)) throw new Error("INVALID_BOOKING_STATUS");

  let bookingData: Record<string, unknown> | null = null;
  let currentUserId: string | null = null;

  await runTransaction(db, async tx => {
    const ref = doc(db, "bookings", bookingId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("BOOKING_NOT_FOUND");
    const currentStatus = String(snap.data()?.status ?? "");
    // CR-5 FIX: Add auth check with authorizedUid parameter
    currentUserId = authorizedUid ?? auth.currentUser?.uid ?? null;

    if (!currentUserId) {
      throw new Error("NOT_AUTHENTICATED");
    }
    bookingData = snap.data() as Record<string, unknown>;
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
        // [Bug #5 FIX] Block direct cancellation when escrow is held.
        // Callers MUST use cancelBookingAndRefund() from coinService to ensure
        // escrow coins are atomically refunded. Allowing updateBookingStatus("cancelled")
        // with held escrow would permanently lose the client's coins.
        {
          const escrowStatus = String(bookingData.escrowStatus || "none");
          const escrowCoins = Number(bookingData.escrowCoins || 0);
          if (escrowCoins > 0 && escrowStatus === "held") {
            throw new Error("USE_CANCEL_WITH_REFUND");
          }
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

  if (bookingData && currentUserId) {
    const clientUid = String((bookingData as any).clientId || (bookingData as any).clientUid || "");
    const serviceName = String((bookingData as any).serviceName || "Booking");
    const clientName = String((bookingData as any).clientName || "Client");
    const proName = String((bookingData as any).proName || "Pro");

    if (status === "cancelled") {
      const isClient = currentUserId === clientUid;
      const counterparty = isClient ? proName : clientName;
      await logActivity(currentUserId, "booking.cancelled", `${isClient ? "Cancelled" : "Declined"} booking: ${serviceName} ${isClient ? "with" : "from"} ${counterparty}`, {
        bookingId,
        role: isClient ? "client" : "pro",
        escrowRefunded: (bookingData as any).escrowCoins || 0
      });
    } else if (status === "completed") {
      await logActivity(currentUserId, "booking.completed", `Completed booking: ${serviceName} for ${clientName}`, {
        bookingId,
        role: "pro",
        escrowReleased: (bookingData as any).escrowCoins || 0
      });
    } else if (status === "confirmed") {
      await logActivity(currentUserId, "booking.confirmed", `Confirmed booking: ${serviceName} from ${clientName}`, {
        bookingId,
        role: "pro"
      });
    } else if (status === "reviewed") {
      await logActivity(currentUserId, "booking.reviewed", `Reviewed booking: ${serviceName} with ${proName}`, {
        bookingId,
        role: "client"
      });
    }
  }
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

// Bug #1 fix: Removed duplicate cancelBookingAndRefund from bookingService.
// Use coinService.cancelBookingAndRefund instead (enforces role, updates cashableBalance).

export async function getLastBookedPro(uid: string): Promise<string | null> {
  const lastBooking = await getLastCompletedBookingForUser(uid);
  return (lastBooking?.proId as string) || null;
}
