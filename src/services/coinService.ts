import {
  collection, collectionGroup, doc, getDoc, getDocs, updateDoc,
  serverTimestamp, query, orderBy, limit, runTransaction, where, setDoc, startAfter,
  Transaction, getAggregateFromServer, sum, count, type QueryConstraint, type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { FirestoreTimestamp } from "../types/firestore";

export type LedgerType =
  | "topup" | "booking_debit" | "booking_refund" | "booking_escrow"
  | "booking_escrow_release" | "payout" | "payout_cancelled"
  | "earn_review" | "earn_referral" | "earn_free_consult" | "earn_profile"
  | "earn_milestone" | "earn_groupsession" | "earn_ondemand" | "earn_signup_bonus"
  | "loyalty_cashback" | "pro_loyalty_bonus"
  | "admin_credit" | "admin_debit";

export interface LedgerEntry {
  id?: string;
  uid: string;
  type: LedgerType;
  amount: number;
  balanceAfter: number;
  description: string;
  refId?: string;
  createdAt: FirestoreTimestamp;
}

export interface CoinPurchase {
  id?: string;
  uid: string;
  amountPaid: number;
  coinsGranted: number;
  packLabel: string;
  status: "pending" | "completed" | "failed";
  razorpayOrderId?: string;
  paymentId?: string;
  createdAt: FirestoreTimestamp;
  completedAt?: FirestoreTimestamp;
}

export interface CoinPayout {
  id?: string;
  uid: string;
  displayName: string;
  coinsRedeemed: number;
  amountRs: number;
  upiId: string;
  upiMasked?: string;
  status: "pending" | "processed" | "failed" | "cancelled_by_user";
  processedBy?: string;
  processedAt?: FirestoreTimestamp;
  cancelledAt?: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
}

export function maskUpiId(upiId: string): string {
  const [handle = "", domain = ""] = upiId.trim().split("@");
  if (!handle || !domain) return "***";
  const visiblePrefix = handle.slice(0, 2);
  const visibleSuffix = handle.length > 4 ? handle.slice(-2) : "";
  const maskedLen = Math.max(2, handle.length - visiblePrefix.length - visibleSuffix.length);
  return `${visiblePrefix}${"*".repeat(maskedLen)}${visibleSuffix}@${domain}`;
}

export const COIN_PACKS = [
  { label: "Trial", priceRs: 50, coins: 50, bonus: 0, popular: false },
  { label: "Starter", priceRs: 200, coins: 200, bonus: 20, popular: false },
  { label: "Popular", priceRs: 500, coins: 500, bonus: 75, popular: true },
  { label: "Pro", priceRs: 1000, coins: 1000, bonus: 175, popular: false },
  { label: "Society", priceRs: 2500, coins: 2500, bonus: 500, popular: false },
];

export const EARN_RULES: Record<LedgerType, { coins: number; label: string }> = {
  earn_signup_bonus: { coins: 100, label: "Welcome bonus 🎉" },
  earn_profile: { coins: 20, label: "Profile completed" },
  earn_review: { coins: 10, label: "Review written" },
  earn_referral: { coins: 100, label: "Referral reward" },
  earn_free_consult: { coins: 50, label: "Free consultation given" },
  earn_groupsession: { coins: 5, label: "Group session attended" },
  earn_ondemand: { coins: 75, label: "On-demand request fulfilled" },
  earn_milestone: { coins: 50, label: "Community milestone" },
  topup: { coins: 0, label: "Coins purchased" },
  booking_debit: { coins: 0, label: "Booking payment" },
  booking_escrow: { coins: 0, label: "Booking payment (held)" },
  booking_escrow_release: { coins: 0, label: "Session earnings" },
  booking_refund: { coins: 0, label: "Booking refund" },
  payout: { coins: 0, label: "Payout processed" },
  payout_cancelled: { coins: 0, label: "Payout cancelled" },
  loyalty_cashback: { coins: 0, label: "Loyalty cashback" },
  pro_loyalty_bonus: { coins: 0, label: "Loyalty pro bonus" },
  admin_credit: { coins: 0, label: "Admin credit" },
  admin_debit: { coins: 0, label: "Admin debit" },
};

async function queueLedgerCredit(tx: Transaction, params: {
  uid: string;
  entryId: string;
  type: LedgerType;
  amount: number;
  description: string;
  refId: string;
}) {
  const { uid, entryId, type, amount, description, refId } = params;
  if (amount <= 0) return false;

  const userRef = doc(db, "users", uid);
  const entryRef = doc(collection(db, "coinLedger", uid, "entries"), entryId);
  const existingEntry = await tx.get(entryRef);
  if (existingEntry.exists()) return false;

  const userSnap = await tx.get(userRef);
  const newBal = ((userSnap.data()?.coinBalance as number) ?? 0) + amount;
  tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
  tx.set(entryRef, {
    uid,
    type,
    amount,
    balanceAfter: newBal,
    description,
    refId,
    createdAt: serverTimestamp(),
  } as LedgerEntry);
  return true;
}

export async function queueLoyaltyCashbackCredit(
  tx: Transaction,
  uid: string,
  bookingId: string,
  amount: number,
  serviceName = "session",
) {
  return queueLedgerCredit(tx, {
    uid,
    entryId: `${bookingId}_loyalty_cashback`,
    type: "loyalty_cashback",
    amount,
    description: `Loyalty cashback for ${serviceName}`,
    refId: bookingId,
  });
}

export async function queueProLoyaltyBonusCredit(
  tx: Transaction,
  uid: string,
  bookingId: string,
  amount: number,
  serviceName = "session",
) {
  return queueLedgerCredit(tx, {
    uid,
    entryId: `${bookingId}_pro_loyalty_bonus`,
    type: "pro_loyalty_bonus",
    amount,
    description: `Loyalty bonus for ${serviceName}`,
    refId: bookingId,
  });
}

export async function creditLoyaltyCashback(uid: string, bookingId: string, amount: number, serviceName?: string): Promise<void> {
  await runTransaction(db, async tx => {
    await queueLoyaltyCashbackCredit(tx, uid, bookingId, amount, serviceName);
  });
}

export async function creditProLoyaltyBonus(uid: string, bookingId: string, amount: number, serviceName?: string): Promise<void> {
  await runTransaction(db, async tx => {
    await queueProLoyaltyBonusCredit(tx, uid, bookingId, amount, serviceName);
  });
}

// ── NC Terms (read from appSettings, fallback defaults) ──────────────────
export interface NCTerms {
  expiryDays: number | null;       // null = never expire
  refundPolicy: string;
  earnCap: string;
  minPayout: number;
  platformFeePct: number;
  lastUpdated?: unknown;
}

export const NC_TERMS_DEFAULTS: NCTerms = {
  expiryDays: null,
  refundPolicy: "Unused purchased NC refunded within 7 days of purchase if no bookings made. Earned NC is non-refundable.",
  earnCap: "Earned NC capped at 20% of monthly booking value.",
  minPayout: 200,
  platformFeePct: 10,
};

export async function getNCTerms(): Promise<NCTerms> {
  try {
    const snap = await getDoc(doc(db, "appSettings", "ncTerms"));
    if (snap.exists()) return { ...NC_TERMS_DEFAULTS, ...snap.data() } as NCTerms;
  } catch { /* fallback */ }
  return NC_TERMS_DEFAULTS;
}

// ── Referral ─────────────────────────────────────────────────────────────
export function generateReferralCode(params: {
  displayName?: string;
  phoneNumber?: string;
  uid?: string;
}): string {
  const { displayName = "", phoneNumber = "", uid = "" } = params;
  const parts = displayName.trim().split(/\s+/).filter(Boolean);

  // Required format: "PN" + 6 uppercase alphanumeric characters.
  const initials = parts
    .map(part => part.replace(/[^a-zA-Z]/g, "").charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const phoneTail = phoneNumber.replace(/\D/g, "").slice(-4);
  const uidTail = uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-4);
  const seed = `${initials}${phoneTail || uidTail}`.replace(/[^A-Z0-9]/g, "");
  const body = seed.padEnd(6, "X").slice(0, 6);

  return `PN${body}`;
}

/**
 * Apply a referral code. Both referrer and new user earn 100 NC
 * on the new user's first completed booking (triggered from booking completion).
 * This function just validates + stores the referral link.
 */
export async function applyReferralCode(
  newUserUid: string,
  code: string
): Promise<{ success: boolean; reason?: string }> {
  if (!code?.trim()) return { success: false, reason: "No code entered." };
  const upper = code.trim().toUpperCase();

  // Find referrer by code
  const q = query(collection(db, "users"), where("referralCode", "==", upper), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return { success: false, reason: "Invalid referral code." };

  const referrerUid = snap.docs[0].id;
  if (referrerUid === newUserUid) return { success: false, reason: "Can't refer yourself." };

  // Check not already applied
  const existing = await getDoc(doc(db, "referrals", newUserUid));
  if (existing.exists()) return { success: false, reason: "Referral code already applied." };

  await setDoc(doc(db, "referrals", newUserUid), {
    newUserUid,
    referrerUid,
    code: upper,
    status: "pending", // becomes "rewarded" on first booking completion
    createdAt: serverTimestamp(),
  });

  return { success: true };
}

/**
 * Reward referral — called when new user completes their first booking.
 * Now requires bookingId parameter and verifies booking.status === "completed" within transaction.
 */
export async function rewardReferral(newUserUid: string, bookingId: string): Promise<void> {
  await runTransaction(db, async tx => {
    // 1. Verify booking is completed (booking completion check)
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists() || bookingSnap.data()?.status !== "completed") {
      throw new Error("Cannot reward referral: booking must be completed");
    }

    // 2. Verify referral is pending
    const refRef = doc(db, "referrals", newUserUid);
    const refSnap = await tx.get(refRef);
    if (!refSnap.exists() || refSnap.data().status !== "pending") return;

    const { referrerUid } = refSnap.data() as { referrerUid: string };
    const rule = EARN_RULES.earn_referral;

    // 3. Reward Referrer
    const rRef = doc(db, "users", referrerUid);
    const rSnap = await tx.get(rRef);
    const rBal = ((rSnap.data()?.coinBalance as number) ?? 0) + rule.coins;
    tx.update(rRef, { coinBalance: rBal, updatedAt: serverTimestamp() });
    tx.set(doc(collection(db, "coinLedger", referrerUid, "entries")), {
      uid: referrerUid, type: "earn_referral", amount: rule.coins, balanceAfter: rBal,
      description: `Referral reward (for inviting ${newUserUid.slice(0, 5)}...)`,
      refId: newUserUid, createdAt: serverTimestamp()
    } as LedgerEntry);

    // 4. Reward New User
    const nRef = doc(db, "users", newUserUid);
    const nSnap = await tx.get(nRef);
    const nBal = ((nSnap.data()?.coinBalance as number) ?? 0) + rule.coins;
    tx.update(nRef, { coinBalance: nBal, updatedAt: serverTimestamp() });
    tx.set(doc(collection(db, "coinLedger", newUserUid, "entries")), {
      uid: newUserUid, type: "earn_referral", amount: rule.coins, balanceAfter: nBal,
      description: `Referral reward (invited by ${referrerUid.slice(0, 5)}...)`,
      refId: referrerUid, createdAt: serverTimestamp()
    } as LedgerEntry);

    // 5. Mark referral as rewarded
    tx.update(refRef, { status: "rewarded", updatedAt: serverTimestamp() });
  });
}

// ── Core coin fns ─────────────────────────────────────────────────────────
export async function getCoinBalance(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", uid));
  return (snap.data()?.coinBalance as number) ?? 0;
}

export async function getLedger(uid: string, pageLimit = 50): Promise<LedgerEntry[]> {
  const q = query(collection(db, "coinLedger", uid, "entries"), orderBy("createdAt", "desc"), limit(pageLimit));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
}

export async function topUpCoins(uid: string, priceRs: number, coins: number, packLabel: string, paymentId: string): Promise<void> {
  const purchaseId = paymentId.trim();
  if (!purchaseId) throw new Error("MISSING_PAYMENT_ID");

  await runTransaction(db, async tx => {
    const userRef = doc(db, "users", uid);
    const purchaseRef = doc(db, "coinPurchases", purchaseId);
    const ledgerRef = doc(db, "coinLedger", uid, "entries", `${purchaseId}_topup`);

    // Idempotency guard: if this payment was already credited, skip.
    const existingPurchase = await tx.get(purchaseRef);
    if (existingPurchase.exists()) return;

    const userSnap = await tx.get(userRef);
    const newBal = ((userSnap.data()?.coinBalance as number) ?? 0) + coins;

    tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
    tx.set(purchaseRef, {
      uid,
      amountPaid: priceRs,
      coinsGranted: coins,
      packLabel,
      status: "completed",
      paymentId: purchaseId,
      createdAt: serverTimestamp(),
      completedAt: serverTimestamp(),
    } as CoinPurchase);
    tx.set(ledgerRef, {
      uid,
      type: "topup",
      amount: coins,
      balanceAfter: newBal,
      description: `${packLabel} Pack — ₹${priceRs} → ${coins} NC`,
      refId: purchaseId,
      createdAt: serverTimestamp(),
    } as LedgerEntry);
  });
}

export async function holdEscrow(clientUid: string, bookingId: string, coins: number, serviceName: string): Promise<{ success: boolean; reason?: string }> {
  if (coins === 0) return { success: true };
  try {
    await runTransaction(db, async tx => {
      // Deterministic ledger entry ID for idempotency on concurrent requests
      const ledgerEntryId = `${bookingId}_hold_${clientUid}`;
      const ledgerEntryRef = doc(collection(db, "coinLedger", clientUid, "entries"), ledgerEntryId);
      
      // Check if this escrow hold already exists (race condition guard)
      const existingEntry = await tx.get(ledgerEntryRef);
      if (existingEntry.exists()) {
        // Already held, skip
        return;
      }

      const clientRef = doc(db, "users", clientUid);
      const clientSnap = await tx.get(clientRef);
      const clientBal = (clientSnap.data()?.coinBalance as number) ?? 0;
      if (clientBal < coins) throw new Error("INSUFFICIENT_BALANCE");
      const newBal = clientBal - coins;
      tx.update(clientRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
      tx.update(doc(db, "bookings", bookingId), { escrowCoins: coins, coinsPaid: true, escrowStatus: "held", updatedAt: serverTimestamp() });
      tx.set(ledgerEntryRef, { uid: clientUid, type: "booking_escrow", amount: -coins, balanceAfter: newBal, description: `Payment held: ${serviceName}`, refId: bookingId, createdAt: serverTimestamp() } as LedgerEntry);
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    return { success: false, reason: msg === "INSUFFICIENT_BALANCE" ? "INSUFFICIENT_BALANCE" : "TRANSACTION_FAILED" };
  }
}

export async function releaseEscrow(proUid: string, bookingId: string, serviceName: string, platformFeePct = 0.10): Promise<{ success: boolean; reason?: string }> {
  try {
    await runTransaction(db, async tx => {
      // Deterministic ledger entry ID for idempotency on concurrent release requests
      const ledgerEntryId = `${bookingId}_release_${proUid}`;
      const ledgerEntryRef = doc(collection(db, "coinLedger", proUid, "entries"), ledgerEntryId);
      
      // Check if this escrow release already exists (race condition guard)
      const existingEntry = await tx.get(ledgerEntryRef);
      if (existingEntry.exists()) {
        // Already released, skip
        return;
      }

      const bookingRef = doc(db, "bookings", bookingId);
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists()) throw new Error("BOOKING_NOT_FOUND");
      const data = bookingSnap.data()!;
      
      // Additional idempotency guard via booking status
      if (data.escrowStatus === "released") return;
      
      const escrowCoins = (data.escrowCoins as number) ?? 0;
      if (escrowCoins === 0) {
        // No escrow but still ensure marked completed atomically
        tx.update(bookingRef, { status: "completed", updatedAt: serverTimestamp() });
        return;
      }
      const platformFee = Math.round(escrowCoins * platformFeePct);
      const proEarning = escrowCoins - platformFee;
      const proRef = doc(db, "users", proUid);
      const proSnap = await tx.get(proRef);
      const newProBal = ((proSnap.data()?.coinBalance as number) ?? 0) + proEarning;
      // All writes in one atomic batch — status update included
      tx.update(proRef, { coinBalance: newProBal, updatedAt: serverTimestamp() });
      tx.update(bookingRef, {
        status: "completed",
        escrowStatus: "released",
        platformFee, proEarning, paidInCoins: escrowCoins,
        updatedAt: serverTimestamp(),
      });
      tx.set(ledgerEntryRef, {
        uid: proUid, type: "booking_escrow_release", amount: proEarning,
        balanceAfter: newProBal,
        description: `Earned: ${serviceName} (10% platform fee deducted)`,
        refId: bookingId, createdAt: serverTimestamp(),
      } as LedgerEntry);
    });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, reason: e instanceof Error ? e.message : "TRANSACTION_FAILED" };
  }
}

export async function refundEscrow(clientUid: string, bookingId: string, serviceName: string): Promise<void> {
  await runTransaction(db, async tx => {
    // Deterministic ledger entry ID for idempotency on concurrent refund requests
    const ledgerEntryId = `${bookingId}_refund_${clientUid}`;
    const ledgerEntryRef = doc(collection(db, "coinLedger", clientUid, "entries"), ledgerEntryId);
    
    // Check if this escrow refund already exists (race condition guard)
    const existingEntry = await tx.get(ledgerEntryRef);
    if (existingEntry.exists()) {
      // Already refunded, skip
      return;
    }

    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await tx.get(bookingRef);
    const data = bookingSnap.data();
    if (!data) return;

    const escrowCoins = (data.escrowCoins as number) ?? 0;
    const escrowStatus = data.escrowStatus as string;

    // If already released, it cannot be refunded.
    if (escrowStatus === "released") return;
    // If already refunded, skip.
    if (escrowStatus === "refunded") return;

    if (escrowCoins === 0) {
      tx.update(bookingRef, { escrowStatus: "refunded", updatedAt: serverTimestamp() });
      return;
    }

    const userRef = doc(db, "users", clientUid);
    const snap = await tx.get(userRef);
    const newBal = ((snap.data()?.coinBalance as number) ?? 0) + escrowCoins;
    
    tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
    tx.update(bookingRef, { escrowStatus: "refunded", coinsPaid: false, updatedAt: serverTimestamp() });
    tx.set(ledgerEntryRef, {
      uid: clientUid, type: "booking_refund", amount: escrowCoins, balanceAfter: newBal,
      description: `Refund: ${serviceName}`, refId: bookingId, createdAt: serverTimestamp()
    } as LedgerEntry);
  });
}

/**
 * Atomically cancels a booking and refunds escrow if present.
 * This prevents the race where a booking is marked 'cancelled' but the refund fails.
 */
export async function cancelBookingAndRefund(uid: string, bookingId: string, _role: "client" | "pro"): Promise<{ success: boolean; reason?: string }> {
  try {
    await runTransaction(db, async tx => {
      const bookingRef = doc(db, "bookings", bookingId);
      const bookingSnap = await tx.get(bookingRef);
      const data = bookingSnap.data();
      if (!data) throw new Error("BOOKING_NOT_FOUND");
      
      const status = data.status as string;
      if (status === "cancelled" || status === "completed" || status === "reviewed") {
        throw new Error("ALREADY_FINALIZED");
      }

      const escrowCoins = (data.escrowCoins as number) || 0;
      const escrowStatus = data.escrowStatus as string;
      const clientUid = data.clientId as string;
      const serviceName = (data.serviceName as string) || "Booking";

      // 1. Mark booking as cancelled
      tx.update(bookingRef, { 
        status: "cancelled", 
        updatedAt: serverTimestamp(),
        cancelledBy: uid,
        cancelledAt: serverTimestamp()
      });

      // 2. Handle escrow refund if held
      if (escrowCoins > 0 && escrowStatus === "held") {
        const clientRef = doc(db, "users", clientUid);
        const clientSnap = await tx.get(clientRef);
        const newBal = ((clientSnap.data()?.coinBalance as number) ?? 0) + escrowCoins;

        tx.update(clientRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
        tx.update(bookingRef, { escrowStatus: "refunded", coinsPaid: false });
        tx.set(doc(collection(db, "coinLedger", clientUid, "entries")), {
          uid: clientUid, type: "booking_refund", amount: escrowCoins, balanceAfter: newBal,
          description: `Refund (Cancellation): ${serviceName}`, refId: bookingId, createdAt: serverTimestamp()
        } as LedgerEntry);
      }
    });
    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, reason: message };
  }
}

export const payForBooking = holdEscrow as unknown as (clientUid: string, proUid: string, bookingId: string, coins: number, serviceName: string) => Promise<{ success: boolean; reason?: string }>;
export const refundBooking = (clientUid: string, bookingId: string, _coins: number, serviceName: string) => refundEscrow(clientUid, bookingId, serviceName);

export async function earnCoins(uid: string, type: LedgerType, refId?: string): Promise<void> {
  const rule = EARN_RULES[type];
  if (!rule || rule.coins === 0) return;

  // Deterministic dedup document ID — checked atomically INSIDE the transaction
  // to eliminate the TOCTOU race that a pre-transaction getDocs check would cause.
  const dedupDocId = refId ? `${uid}_${type}_${refId}` : `${uid}_${type}`;
  const dedupRef = doc(collection(db, "coinLedger", uid, "entries"), dedupDocId);

  await runTransaction(db, async tx => {
    // Dedup check inside the transaction — atomic and race-free
    const existing = await tx.get(dedupRef);
    if (existing.exists()) return; // Already credited

    const userRef = doc(db, "users", uid);
    const snap = await tx.get(userRef);
    const newBal = ((snap.data()?.coinBalance as number) ?? 0) + rule.coins;
    tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
    tx.set(dedupRef, {
      uid, type, amount: rule.coins, balanceAfter: newBal,
      description: rule.label, refId: refId ?? null, createdAt: serverTimestamp(),
    } as LedgerEntry);
  });
}

export const MIN_PAYOUT_COINS = 200;

export async function requestPayout(uid: string, displayName: string, coins: number, upiId: string): Promise<{ success: boolean; reason?: string }> {
  if (coins < MIN_PAYOUT_COINS) return { success: false, reason: `Minimum payout is ${MIN_PAYOUT_COINS} NC` };
  const existingPending = await getPendingPayoutForUser(uid);
  if (existingPending) {
    console.info(`Duplicate payout prevented for user ${uid}`);
    return {
      success: false,
      reason: "A payout request is already pending. Please wait for processing or cancel existing request.",
    };
  }
  const maskedUpi = maskUpiId(upiId);
  try {
    await runTransaction(db, async tx => {
      const userRef = doc(db, "users", uid);
      const snap = await tx.get(userRef);
      const balance = (snap.data()?.coinBalance as number) ?? 0;
      if (balance < coins) throw new Error("INSUFFICIENT_BALANCE");
      const newBal = balance - coins;
      tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
      const payoutRef = doc(collection(db, "coinPayouts"));
      tx.set(payoutRef, { uid, displayName, coinsRedeemed: coins, amountRs: coins, upiId, upiMasked: maskedUpi, status: "pending", createdAt: serverTimestamp() } as CoinPayout);
      tx.set(doc(collection(db, "coinLedger", uid, "entries")), { uid, type: "payout", amount: -coins, balanceAfter: newBal, description: `Payout ₹${coins} -> ${maskedUpi}`, refId: payoutRef.id, createdAt: serverTimestamp() } as LedgerEntry);
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    return { success: false, reason: msg === "INSUFFICIENT_BALANCE" ? "Insufficient balance" : "Transaction failed" };
  }
}

export async function getPendingPayoutForUser(uid: string): Promise<CoinPayout | null> {
  const primary = await getDocs(
    query(
      collection(db, "coinPayouts"),
      where("uid", "==", uid),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
      limit(1)
    )
  ).catch(async () => {
    return getDocs(query(collection(db, "coinPayouts"), where("uid", "==", uid), where("status", "==", "pending"), limit(1)));
  });

  if (primary.empty) return null;
  const payout = { id: primary.docs[0].id, ...primary.docs[0].data() } as CoinPayout;
  return { ...payout, upiMasked: payout.upiMasked || maskUpiId(payout.upiId || "") };
}

export async function cancelPayoutRequest(uid: string, payoutId: string): Promise<{ success: boolean; reason?: string }> {
  try {
    await runTransaction(db, async tx => {
      const payoutRef = doc(db, "coinPayouts", payoutId);
      const payoutSnap = await tx.get(payoutRef);
      if (!payoutSnap.exists()) throw new Error("PAYOUT_NOT_FOUND");

      const payout = payoutSnap.data() as CoinPayout;
      if (payout.uid !== uid) throw new Error("UNAUTHORIZED");
      if (payout.status !== "pending") throw new Error("NOT_PENDING");

      const userRef = doc(db, "users", uid);
      const userSnap = await tx.get(userRef);
      const currentBalance = (userSnap.data()?.coinBalance as number) ?? 0;
      const refundedBalance = currentBalance + (payout.coinsRedeemed || 0);

      tx.update(userRef, { coinBalance: refundedBalance, updatedAt: serverTimestamp() });
      tx.update(payoutRef, { status: "cancelled_by_user", cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
      tx.set(doc(collection(db, "coinLedger", uid, "entries")), {
        uid,
        type: "payout_cancelled",
        amount: payout.coinsRedeemed,
        balanceAfter: refundedBalance,
        description: `Payout cancelled (refund): ₹${payout.amountRs}`,
        refId: payoutId,
        createdAt: serverTimestamp(),
      } as LedgerEntry);
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_PENDING") return { success: false, reason: "Only pending payouts can be cancelled." };
    if (msg === "UNAUTHORIZED") return { success: false, reason: "You can cancel only your own payout." };
    if (msg === "PAYOUT_NOT_FOUND") return { success: false, reason: "Payout request not found." };
    return { success: false, reason: "Failed to cancel payout request." };
  }
}

/* ── Admin ── */
export async function getAllCoinPurchases(
  pageLimit = 100,
  cursor?: DocumentSnapshot<CoinPurchase>
): Promise<{ data: CoinPurchase[]; nextCursor: DocumentSnapshot<CoinPurchase> | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(pageLimit)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "coinPurchases"), ...constraints));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CoinPurchase));
  const nextCursor = snap.docs.length === pageLimit ? (snap.docs[snap.docs.length - 1] as DocumentSnapshot<CoinPurchase>) : null;
  return { data, nextCursor };
}

export async function getAllPayouts(
  pageLimit = 100,
  cursor?: DocumentSnapshot<CoinPayout>
): Promise<{ data: CoinPayout[]; nextCursor: DocumentSnapshot<CoinPayout> | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(pageLimit)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "coinPayouts"), ...constraints));
  const data = snap.docs.map(d => {
    const payout = { id: d.id, ...d.data() } as CoinPayout;
    return { ...payout, upiMasked: payout.upiMasked || maskUpiId(payout.upiId || "") };
  });
  const nextCursor = snap.docs.length === pageLimit ? (snap.docs[snap.docs.length - 1] as DocumentSnapshot<CoinPayout>) : null;
  return { data, nextCursor };
}
export async function getPendingPayouts(): Promise<CoinPayout[]> {
  const snap = await getDocs(query(collection(db, "coinPayouts"), where("status", "==", "pending"), orderBy("createdAt", "asc")));
  return snap.docs.map(d => {
    const payout = { id: d.id, ...d.data() } as CoinPayout;
    return { ...payout, upiMasked: payout.upiMasked || maskUpiId(payout.upiId || "") };
  });
}
export async function updatePayoutStatus(payoutId: string, status: "processed" | "failed", adminUid: string): Promise<void> {
  await updateDoc(doc(db, "coinPayouts", payoutId), { status, processedBy: adminUid, processedAt: serverTimestamp() });
}
export async function adminAdjustCoins(uid: string, amount: number, reason: string, adminUid: string): Promise<{ success: boolean; reason?: string }> {
  if (amount === 0) return { success: false, reason: "Amount cannot be zero" };
  try {
    await runTransaction(db, async tx => {
      const userRef = doc(db, "users", uid);
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error("USER_NOT_FOUND");
      const newBal = ((snap.data()?.coinBalance as number) ?? 0) + amount;
      if (newBal < 0) throw new Error("WOULD_GO_NEGATIVE");
      tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
      tx.set(doc(collection(db, "coinLedger", uid, "entries")), { uid, type: amount > 0 ? "admin_credit" : "admin_debit", amount, balanceAfter: newBal, description: `Admin ${amount > 0 ? "credit" : "debit"}: ${reason}`, refId: adminUid, createdAt: serverTimestamp() } as LedgerEntry);
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "USER_NOT_FOUND") return { success: false, reason: "User not found" };
    if (msg === "WOULD_GO_NEGATIVE") return { success: false, reason: "Balance would go negative" };
    return { success: false, reason: "Transaction failed" };
  }
}
export async function getCoinEconomySummary() {
  const earnTypes = [
    "earn_signup_bonus", "earn_profile", "earn_review", "earn_referral",
    "earn_free_consult", "earn_groupsession", "earn_ondemand", "earn_milestone",
  ];

  try {
    const [
      completedPurchaseNC,
      completedPurchaseRevenue,
      processedPayoutNC,
      pendingPayoutNC,
      pendingPayoutCount,
      totalEarnedNC,
    ] = await Promise.all([
      getAggregateFromServer(
        query(collection(db, "coinPurchases"), where("status", "==", "completed")),
        { total: sum("coinsGranted") }
      ),
      getAggregateFromServer(
        query(collection(db, "coinPurchases"), where("status", "==", "completed")),
        { total: sum("amountPaid") }
      ),
      getAggregateFromServer(
        query(collection(db, "coinPayouts"), where("status", "==", "processed")),
        { total: sum("coinsRedeemed") }
      ),
      getAggregateFromServer(
        query(collection(db, "coinPayouts"), where("status", "==", "pending")),
        { total: sum("coinsRedeemed") }
      ),
      getAggregateFromServer(
        query(collection(db, "coinPayouts"), where("status", "==", "pending")),
        { total: count() }
      ),
      getAggregateFromServer(
        query(collectionGroup(db, "entries"), where("type", "in", earnTypes)),
        { total: sum("amount") }
      ),
    ]);

    return {
      totalPurchasedNC: completedPurchaseNC.data().total ?? 0,
      totalPurchaseRevenue: completedPurchaseRevenue.data().total ?? 0,
      totalPayoutNC: processedPayoutNC.data().total ?? 0,
      totalEarnedNC: totalEarnedNC.data().total ?? 0,
      pendingPayoutNC: pendingPayoutNC.data().total ?? 0,
      pendingPayoutCount: pendingPayoutCount.data().total ?? 0,
    };
  } catch (error) {
    console.warn("Aggregate query failed in getCoinEconomySummary; using fallback totals", error);

    const completedPurchasesSnap = await getDocs(
      query(collection(db, "coinPurchases"), where("status", "==", "completed"))
    );
    const processedPayoutsSnap = await getDocs(
      query(collection(db, "coinPayouts"), where("status", "==", "processed"))
    );
    const pendingPayoutsSnap = await getDocs(
      query(collection(db, "coinPayouts"), where("status", "==", "pending"))
    );

    const totalPurchasedNC = completedPurchasesSnap.docs.reduce((sumNC, d) => {
      return sumNC + (Number(d.data()?.coinsGranted) || 0);
    }, 0);

    const totalPurchaseRevenue = completedPurchasesSnap.docs.reduce((sumRs, d) => {
      return sumRs + (Number(d.data()?.amountPaid) || 0);
    }, 0);

    const totalPayoutNC = processedPayoutsSnap.docs.reduce((sumNC, d) => {
      return sumNC + (Number(d.data()?.coinsRedeemed) || 0);
    }, 0);

    const pendingPayoutNC = pendingPayoutsSnap.docs.reduce((sumNC, d) => {
      return sumNC + (Number(d.data()?.coinsRedeemed) || 0);
    }, 0);

    const pendingPayoutCount = pendingPayoutsSnap.size;

    let totalEarnedNC = 0;
    try {
      const earnedEntriesSnap = await getDocs(
        query(collectionGroup(db, "entries"), where("type", "in", earnTypes))
      );
      totalEarnedNC = earnedEntriesSnap.docs.reduce((sumNC, d) => {
        return sumNC + (Number(d.data()?.amount) || 0);
      }, 0);
    } catch (earnError) {
      // If the collectionGroup query path is unavailable due index state, keep dashboard operational.
      console.warn("Failed to compute totalEarnedNC fallback; defaulting to 0", earnError);
      totalEarnedNC = 0;
    }

    return {
      totalPurchasedNC,
      totalPurchaseRevenue,
      totalPayoutNC,
      totalEarnedNC,
      pendingPayoutNC,
      pendingPayoutCount,
    };
  }
}

export { getLedger as adminGetLedger };
export function formatNC(coins: number): string { return `${coins.toLocaleString("en-IN")} NC`; }
export function ledgerColor(type: LedgerType): string {
  return type.startsWith("earn") || type === "topup" || type === "booking_refund" || type === "booking_escrow_release" || type === "admin_credit" || type === "payout_cancelled" ? "#16a34a" : "#dc2626";
}
export function ledgerSign(amount: number): string {
  return amount >= 0 ? `+${amount.toLocaleString("en-IN")}` : amount.toLocaleString("en-IN");
}
