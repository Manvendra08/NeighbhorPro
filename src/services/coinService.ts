// CHANGELOG:
// [Task 1] fix(requestPayout): moved pending-payout existence check INSIDE runTransaction
//          to eliminate TOCTOU race condition — two concurrent requests could both pass
//          the pre-transaction check before either wrote. Pattern mirrors topUpCoins().
// [Task 6 / fix/reward-referral-status-check] fix(rewardReferral): restored split referral flow.
//          applyReferralCodeAtSignup credits referrer (200 NC) at signup, sets status
//          "rewarded_signup". rewardReferral credits new user (200 NC) on first booking,
//          transitions status to "rewarded_booking". Idempotency guard on both paths.
// [Fix #1] fix(requestPayout): replaced non-transactional getDocs with tx.get() on
//          payoutLock/{uid} sentinel doc. Previous getDocs() inside runTransaction was
//          NOT part of the transaction read set — TOCTOU was not actually fixed.
// [Fix #2] fix(releaseEscrow): guard zero-escrow early return against escrowStatus
//          "refunded" or "released" to prevent re-completing a cancelled booking.
// [Fix #5] fix(rewardReferral): added nSnap.exists() guard before tx.update() to
//          prevent silent transaction failure on partially-created user docs.

import {
  collection, collectionGroup, doc, getDoc, getDocs, updateDoc,
  serverTimestamp, query, orderBy, limit, runTransaction, where, startAfter,
  getAggregateFromServer, sum, count, type QueryConstraint, type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { FirestoreTimestamp } from "../types/firestore";

export type LedgerType =
  | "topup" | "booking_debit" | "booking_refund" | "booking_escrow"
  | "booking_escrow_release" | "payout" | "payout_cancelled"
  | "earn_review" | "earn_referral" | "earn_free_consult" | "earn_profile"
  | "earn_milestone" | "earn_groupsession" | "earn_ondemand" | "earn_signup_bonus"
  | "admin_credit" | "admin_debit" | "subscription_debit";

export const CASHABLE_LEDGER_TYPES: LedgerType[] = [
  "topup",
  "booking_escrow_release",
  "booking_refund"
];

export const PROMO_LEDGER_TYPES: LedgerType[] = [
  "earn_signup_bonus",
  "earn_profile",
  "earn_referral",
  "earn_review",
  "earn_free_consult",
  "earn_milestone",
  "earn_groupsession",
  "earn_ondemand",
  "admin_credit"
];

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
  { label: "Trial", priceRs: 300, coins: 300, bonus: 0, popular: false },
  { label: "Starter", priceRs: 1000, coins: 1000, bonus: 100, popular: false },
  { label: "Popular", priceRs: 1500, coins: 1500, bonus: 200, popular: true },
  { label: "Pro", priceRs: 2000, coins: 2000, bonus: 250, popular: false },
  { label: "Society", priceRs: 2500, coins: 2500, bonus: 500, popular: false },
];

export const EARN_RULES: Record<LedgerType, { coins: number; label: string }> = {
  earn_signup_bonus: { coins: 500, label: "Welcome bonus 🎉" },
  earn_profile: { coins: 50, label: "Profile completed" },
  earn_review: { coins: 20, label: "Review written" },
  earn_referral: { coins: 200, label: "Referral reward" },
  earn_free_consult: { coins: 100, label: "Free consultation given" },
  earn_groupsession: { coins: 25, label: "Group session attended" },
  earn_ondemand: { coins: 50, label: "On-demand request fulfilled" },
  earn_milestone: { coins: 50, label: "Community milestone" },
  topup: { coins: 0, label: "Coins purchased" },
  booking_debit: { coins: 0, label: "Booking payment" },
  booking_escrow: { coins: 0, label: "Booking payment (held)" },
  booking_escrow_release: { coins: 0, label: "Session earnings" },
  booking_refund: { coins: 0, label: "Booking refund" },
  payout: { coins: 0, label: "Payout processed" },
  payout_cancelled: { coins: 0, label: "Payout cancelled" },
  admin_credit: { coins: 0, label: "Admin credit" },
  admin_debit: { coins: 0, label: "Admin debit" },
  subscription_debit: { coins: 0, label: "Subscription Debit" },
};

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
  platformFeePct: 15,
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

  // Prefer UID-derived code for stability and near-zero collision risk.
  const uidSeed = uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (uidSeed.length >= 6) {
    return `PN${uidSeed.slice(-6)}`;
  }

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
 * Validate referral code format: must be "PN" + 6 uppercase alphanumeric chars (8 chars total)
 */
export function isValidReferralCode(code: string | undefined): boolean {
  if (!code || typeof code !== "string") return false;
  const normalized = code.trim().toUpperCase();
  return /^PN[A-Z0-9]{6}$/.test(normalized);
}

/**
 * Normalize referral code: trim whitespace and convert to uppercase
 */
export function normalizeReferralCode(code: string | undefined): string {
  if (!code || typeof code !== "string") return "";
  return code.trim().toUpperCase();
}

export async function generateUniqueReferralCode(params: {
  displayName?: string;
  phoneNumber?: string;
  uid?: string;
}): Promise<string> {
  // UID-based code generation is deterministic and practically collision-free.
  // Avoiding Firestore reads here keeps signup reliable even if index rules lag behind.
  return generateReferralCode(params);
}

async function getReferrerUidFromCode(code: string): Promise<string | null> {
  try {
    const codeSnap = await getDoc(doc(db, "referralCodes", code));
    if (!codeSnap.exists()) return null;
    const uid = codeSnap.data()?.uid;
    return typeof uid === "string" && uid.trim() ? uid : null;
  } catch {
    return null;
  }
}

/**
 * Apply a referral code for the current user.
 * Delegates to applyReferralCodeAtSignup.
 */
export async function applyReferralCode(
  newUserUid: string,
  code: string
): Promise<{ success: boolean; reason?: string }> {
  return applyReferralCodeAtSignup(newUserUid, code);
}

/**
 * Step 1 of the split referral flow.
 * Credits the REFERRER (200 NC) immediately at signup and records the referral
 * with status "rewarded_signup". This status is the trigger condition for
 * rewardReferral() to fire on the new user's first completed booking.
 */
export async function applyReferralCodeAtSignup(
  newUserUid: string,
  code: string,
): Promise<{ success: boolean; reason?: string }> {
  const upper = normalizeReferralCode(code);
  if (!isValidReferralCode(upper)) return { success: false, reason: "Invalid referral code." };

  const referrerUid = await getReferrerUidFromCode(upper);
  if (!referrerUid) return { success: false, reason: "Invalid referral code." };
  if (referrerUid === newUserUid) return { success: false, reason: "Can't refer yourself." };

  const rule = EARN_RULES.earn_referral;
  try {
    await runTransaction(db, async tx => {
      const referralRef = doc(db, "referrals", newUserUid);
      const referralSnap = await tx.get(referralRef);
      if (referralSnap.exists()) {
        throw new Error("REFERRAL_ALREADY_APPLIED");
      }

      const userRef = doc(db, "users", newUserUid);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) {
        throw new Error("USER_NOT_FOUND");
      }

      const referrerRef = doc(db, "users", referrerUid);
      const referrerSnap = await tx.get(referrerRef);
      if (!referrerSnap.exists()) {
        throw new Error("REFERRER_NOT_FOUND");
      }

      const ledgerId = `${newUserUid}_signup_referral_referrer`;
      const ledgerRef = doc(db, "coinLedger", referrerUid, "entries", ledgerId);
      const ledgerSnap = await tx.get(ledgerRef);
      if (ledgerSnap.exists()) {
        throw new Error("REFERRAL_ALREADY_APPLIED");
      }

      const currentBalance = ((referrerSnap.data()?.coinBalance as number) ?? 0);
      const newBalance = currentBalance + rule.coins;

      tx.update(referrerRef, { coinBalance: newBalance, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerId });
      tx.set(ledgerRef, {
        uid: referrerUid,
        type: "earn_referral",
        amount: rule.coins,
        balanceAfter: newBalance,
        description: `Referral signup credit (${upper})`,
        refId: newUserUid,
        createdAt: serverTimestamp(),
      } as LedgerEntry);

      // Status "rewarded_signup" signals rewardReferral() that this referral
      // is eligible for the second leg (new user first-booking reward).
      tx.set(referralRef, {
        newUserUid,
        referrerUid,
        code: upper,
        status: "rewarded_signup",
        createdAt: serverTimestamp(),
        rewardedAt: serverTimestamp(),
        rewardMode: "split_referrer_signup_newuser_booking",
        rewardCoins: rule.coins,
        rewardToUid: referrerUid,
      });
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message === "REFERRAL_ALREADY_APPLIED") {
      return { success: false, reason: "Referral code already applied." };
    }
    if (message === "USER_NOT_FOUND") {
      return { success: false, reason: "User profile not found." };
    }
    if (message === "REFERRER_NOT_FOUND") {
      return { success: false, reason: "Referrer profile not found." };
    }
    if (message.includes("permission") || message.includes("PERMISSION_DENIED")) {
      return { success: false, reason: "Referral credit could not be applied right now. Try again in Wallet." };
    }
    return { success: false, reason: "Failed to apply referral code." };
  }
}

/**
 * Step 2 of the split referral flow.
 * Credits the NEW USER (200 NC) on their first completed booking.
 *
 * Call this after booking status transitions to "completed".
 * Safe to call multiple times — idempotency guard on ledger entry prevents double-credit.
 *
 * Status flow: "rewarded_signup" → "rewarded_booking"
 * If status is anything other than "rewarded_signup", this is a no-op.
 */
export async function rewardReferral(newUserUid: string, bookingId: string): Promise<void> {
  await runTransaction(db, async tx => {
    // 1. Verify booking is completed
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists() || bookingSnap.data()?.status !== "completed") {
      throw new Error("Cannot reward referral: booking must be completed");
    }

    // 2. Verify referral exists and is eligible for first-booking reward.
    //    Must be "rewarded_signup" — set by applyReferralCodeAtSignup.
    //    Any other status ("rewarded_booking", "rewarded", absent) = no-op.
    const refRef = doc(db, "referrals", newUserUid);
    const refSnap = await tx.get(refRef);
    if (!refSnap.exists()) return;
    const refStatus = refSnap.data().status as string;
    if (refStatus !== "rewarded_signup") return;

    const { referrerUid } = refSnap.data() as { referrerUid: string };
    const rule = EARN_RULES.earn_referral;

    // 3. Idempotency guard — bail silently if already credited on a prior retry
    const newUserLedgerId = `${bookingId}_referral_booking_new_${newUserUid}`;
    const newUserLedgerRef = doc(db, "coinLedger", newUserUid, "entries", newUserLedgerId);
    const existingEntry = await tx.get(newUserLedgerRef);
    if (existingEntry.exists()) return;

    // 4. Credit new user only — referrer already received 200 NC at signup.
    //    [Fix #5] Guard against partially-created user docs to prevent silent
    //    transaction failure (tx.update on non-existent doc throws in Firestore).
    const nRef = doc(db, "users", newUserUid);
    const nSnap = await tx.get(nRef);
    if (!nSnap.exists()) {
      throw new Error("USER_NOT_FOUND");
    }
    const nBal = ((nSnap.data()?.coinBalance as number) ?? 0) + rule.coins;
    tx.update(nRef, { coinBalance: nBal, updatedAt: serverTimestamp(), lastLedgerEntryId: newUserLedgerId });
    tx.set(newUserLedgerRef, {
      uid: newUserUid,
      type: "earn_referral",
      amount: rule.coins,
      balanceAfter: nBal,
      description: `First booking referral reward (invited by ${referrerUid.slice(0, 5)}...)`,
      refId: referrerUid,
      createdAt: serverTimestamp(),
    } as LedgerEntry);

    // 5. Mark referral fully rewarded
    tx.update(refRef, {
      status: "rewarded_booking",
      bookingRewardedAt: serverTimestamp(),
      bookingRewardBookingId: bookingId,
      updatedAt: serverTimestamp(),
    });
  });
}

// ── Core coin fns ─────────────────────────────────────────────────────────
export async function getCoinBalance(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", uid));
  return (snap.data()?.coinBalance as number) ?? 0;
}

export async function getCashableBalance(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", uid));
  return (snap.data()?.cashableBalance as number) ?? 0;
}

export async function getLedger(uid: string, pageLimit = 50): Promise<LedgerEntry[]> {
  try {
    const q = query(collection(db, "coinLedger", uid, "entries"), orderBy("createdAt", "desc"), limit(pageLimit));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
  } catch {
    return [];
  }
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
    const currentCoinBal = (userSnap.data()?.coinBalance as number) ?? 0;
    const currentCashable = (userSnap.data()?.cashableBalance as number) ?? 0;
    const newBal = currentCoinBal + coins;
    const newCashable = currentCashable + coins; // topup is always cashable

    tx.update(userRef, { coinBalance: newBal, cashableBalance: newCashable, updatedAt: serverTimestamp(), lastLedgerEntryId: `${purchaseId}_topup` });
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
      const ledgerEntryId = `${bookingId}_hold_${clientUid}`;
      const ledgerEntryRef = doc(collection(db, "coinLedger", clientUid, "entries"), ledgerEntryId);
      const existingEntry = await tx.get(ledgerEntryRef);
      if (existingEntry.exists()) return;

      const clientRef = doc(db, "users", clientUid);
      const clientSnap = await tx.get(clientRef);
      const clientBal = (clientSnap.data()?.coinBalance as number) ?? 0;
      if (clientBal < coins) throw new Error("INSUFFICIENT_BALANCE");
      const newBal = clientBal - coins;
      tx.update(clientRef, { coinBalance: newBal, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerEntryId });
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
      const ledgerEntryId = `${bookingId}_release_${proUid}`;
      const ledgerEntryRef = doc(collection(db, "coinLedger", proUid, "entries"), ledgerEntryId);
      const existingEntry = await tx.get(ledgerEntryRef);
      if (existingEntry.exists()) return;

      const bookingRef = doc(db, "bookings", bookingId);
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists()) throw new Error("BOOKING_NOT_FOUND");
      const data = bookingSnap.data()!;
      if (data.escrowStatus === "released" || data.status === "reviewed") return;

      const escrowCoins = (data.escrowCoins as number) ?? 0;
      const escrowStatus = data.escrowStatus as string | undefined;

      // [Fix #2] Guard zero-escrow early return: a booking with 0 escrow that was
      // already refunded/released must not be re-completed by the pro.
      if (escrowStatus === "refunded" || escrowStatus === "released") return;

      if (escrowCoins === 0) {
        tx.update(bookingRef, {
          status: "completed",
          completedAt: serverTimestamp(),
          completedBy: proUid,
          updatedAt: serverTimestamp(),
        });
        return;
      }
      const storedCommissionRate = Number(data.commissionRate);
      const storedPlatformFee = Number(data.platformFee);
      const storedProEarning = Number(data.proEarning);
      const effectiveRate = Number.isFinite(storedCommissionRate) && storedCommissionRate >= 0
        ? storedCommissionRate / 100
        : platformFeePct;
      const platformFee = Number.isFinite(storedPlatformFee) && storedPlatformFee >= 0
        ? Math.min(escrowCoins, Math.round(storedPlatformFee))
        : Math.round(escrowCoins * effectiveRate);
      const proEarning = Number.isFinite(storedProEarning) && storedProEarning >= 0
        ? Math.min(escrowCoins, Math.round(storedProEarning))
        : Math.max(0, escrowCoins - platformFee);

      const proRef = doc(db, "users", proUid);
      const proSnap = await tx.get(proRef);
      const newProBal = ((proSnap.data()?.coinBalance as number) ?? 0) + proEarning;
      const newProCashable = ((proSnap.data()?.cashableBalance as number) ?? 0) + proEarning;
      tx.update(proRef, { coinBalance: newProBal, cashableBalance: newProCashable, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerEntryId });
      tx.update(bookingRef, {
        status: "completed",
        escrowStatus: "released",
        platformFee,
        proEarning,
        paidInCoins: escrowCoins,
        coinsPaid: true,
        completedAt: serverTimestamp(),
        completedBy: proUid,
        updatedAt: serverTimestamp(),
      });
      tx.set(ledgerEntryRef, {
        uid: proUid, type: "booking_escrow_release", amount: proEarning,
        balanceAfter: newProBal,
        description: `Earned: ${serviceName} (platform fee deducted)`,
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
    const ledgerEntryId = `${bookingId}_refund_${clientUid}`;
    const ledgerEntryRef = doc(collection(db, "coinLedger", clientUid, "entries"), ledgerEntryId);
    const existingEntry = await tx.get(ledgerEntryRef);
    if (existingEntry.exists()) return;

    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await tx.get(bookingRef);
    const data = bookingSnap.data();
    if (!data) return;

    const escrowCoins = (data.escrowCoins as number) ?? 0;
    const escrowStatus = data.escrowStatus as string;
    if (escrowStatus === "released") return;
    if (escrowStatus === "refunded") return;

    if (escrowCoins === 0) {
      tx.update(bookingRef, {
        status: "cancelled",
        escrowStatus: "refunded",
        cancelledAt: serverTimestamp(),
        cancelledBy: clientUid,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const userRef = doc(db, "users", clientUid);
    const snap = await tx.get(userRef);
    const newBal = ((snap.data()?.coinBalance as number) ?? 0) + escrowCoins;
    const newCashable = ((snap.data()?.cashableBalance as number) ?? 0) + escrowCoins;
    tx.update(userRef, { coinBalance: newBal, cashableBalance: newCashable, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerEntryId });
    tx.update(bookingRef, {
      status: "cancelled",
      escrowStatus: "refunded",
      coinsPaid: false,
      cancelledAt: serverTimestamp(),
      cancelledBy: clientUid,
      updatedAt: serverTimestamp(),
    });
    tx.set(ledgerEntryRef, {
      uid: clientUid, type: "booking_refund", amount: escrowCoins, balanceAfter: newBal,
      description: `Refund: ${serviceName}`, refId: bookingId, createdAt: serverTimestamp()
    } as LedgerEntry);
  });
}

/**
 * Atomically cancels a booking and refunds escrow if present.
 * Prevents the race where booking is marked 'cancelled' but refund fails.
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

      tx.update(bookingRef, {
        status: "cancelled",
        updatedAt: serverTimestamp(),
        cancelledBy: uid,
        cancelledAt: serverTimestamp(),
        declinedBy: _role === "pro" ? uid : null,
        declinedAt: _role === "pro" ? serverTimestamp() : null,
      });

      if (escrowCoins > 0 && escrowStatus === "held") {
        const clientRef = doc(db, "users", clientUid);
        const clientSnap = await tx.get(clientRef);
        const newBal = ((clientSnap.data()?.coinBalance as number) ?? 0) + escrowCoins;
        const newCashable = ((clientSnap.data()?.cashableBalance as number) ?? 0) + escrowCoins;
        const ledgerEntryId = `${bookingId}_refund_${clientUid}`;
        tx.update(clientRef, { coinBalance: newBal, cashableBalance: newCashable, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerEntryId });
        tx.update(bookingRef, { escrowStatus: "refunded", coinsPaid: false });
        tx.set(doc(db, "coinLedger", clientUid, "entries", ledgerEntryId), {
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

  const dedupDocId = refId ? `${uid}_${type}_${refId}` : `${uid}_${type}`;
  const dedupRef = doc(collection(db, "coinLedger", uid, "entries"), dedupDocId);

  await runTransaction(db, async tx => {
    const existing = await tx.get(dedupRef);
    if (existing.exists()) return;

    const userRef = doc(db, "users", uid);
    const snap = await tx.get(userRef);
    const newBal = ((snap.data()?.coinBalance as number) ?? 0) + rule.coins;
    const isPromoType = PROMO_LEDGER_TYPES.includes(type);
    const promoUpdate = isPromoType
      ? { promoBalance: ((snap.data()?.promoBalance as number) ?? 0) + rule.coins }
      : {};
    tx.update(userRef, { coinBalance: newBal, ...promoUpdate, updatedAt: serverTimestamp(), lastLedgerEntryId: dedupDocId });
    tx.set(dedupRef, {
      uid, type, amount: rule.coins, balanceAfter: newBal,
      description: rule.label, refId: refId ?? null, createdAt: serverTimestamp(),
    } as LedgerEntry);
  });
}

export const MIN_PAYOUT_COINS = 200;

/**
 * Request a coin payout.
 *
 * [Fix #1] TOCTOU fix: pending-payout check now uses tx.get() on a
 * payoutLock/{uid} sentinel document instead of getDocs(). The previous
 * getDocs() call inside runTransaction was NOT part of the transaction's
 * read set — Firestore does not track non-tx reads for conflict detection.
 * Two concurrent requests could both pass the getDocs check before either
 * wrote, creating duplicate pending payouts.
 *
 * The sentinel pattern: payoutLock/{uid} is written atomically with the
 * payout document. Any concurrent transaction reading the same sentinel
 * will conflict and retry/fail, guaranteeing at-most-one pending payout.
 */
export async function requestPayout(uid: string, displayName: string, coins: number, upiId: string): Promise<{ success: boolean; reason?: string }> {
  if (coins < MIN_PAYOUT_COINS) return { success: false, reason: `Minimum payout is ${MIN_PAYOUT_COINS} NC` };

  const maskedUpi = maskUpiId(upiId);
  try {
    await runTransaction(db, async tx => {
      // [Fix #1] Transactional pending-payout check via sentinel doc.
      // tx.get() participates in Firestore's read set — concurrent writes
      // to this doc will cause the transaction to retry/abort, preventing
      // duplicate payouts. getDocs() does NOT provide this guarantee.
      const sentinelRef = doc(db, "payoutLock", uid);
      const sentinelSnap = await tx.get(sentinelRef);
      if (sentinelSnap.exists() && sentinelSnap.data()?.status === "pending") {
        throw new Error("DUPLICATE_PAYOUT");
      }

      const userRef = doc(db, "users", uid);
      const snap = await tx.get(userRef);
      const cashable = (snap.data()?.cashableBalance as number) ?? 0;
      if (cashable < coins) throw new Error("INSUFFICIENT_BALANCE");
      const coinBal = (snap.data()?.coinBalance as number) ?? 0;
      const newCashable = cashable - coins;
      const newCoinBal = Math.max(0, coinBal - coins);
      const payoutRef = doc(collection(db, "coinPayouts"));
      const ledgerEntryId = `${payoutRef.id}_payout_${uid}`;

      tx.update(userRef, { coinBalance: newCoinBal, cashableBalance: newCashable, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerEntryId });
      tx.set(payoutRef, { uid, displayName, coinsRedeemed: coins, amountRs: coins, upiId, upiMasked: maskedUpi, status: "pending", createdAt: serverTimestamp() } as CoinPayout);
      tx.set(doc(db, "coinLedger", uid, "entries", ledgerEntryId), { uid, type: "payout", amount: -coins, balanceAfter: newCoinBal, description: `Payout ₹${coins} -> ${maskedUpi}`, refId: payoutRef.id, createdAt: serverTimestamp() } as LedgerEntry);
      // Write sentinel atomically with the payout document.
      tx.set(sentinelRef, { uid, status: "pending", payoutId: payoutRef.id, createdAt: serverTimestamp() });
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "DUPLICATE_PAYOUT") {
      return {
        success: false,
        reason: "A payout request is already pending. Please wait for processing or cancel existing request.",
      };
    }
    return { success: false, reason: msg === "INSUFFICIENT_BALANCE" ? "Insufficient cashable balance. Only real-money sourced NC (from top-ups, booking earnings, refunds) can be withdrawn." : "Transaction failed" };
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
  }).catch(() => null);

  if (!primary) return null;
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
      const currentCashable = (userSnap.data()?.cashableBalance as number) ?? 0;
      const refundedBalance = currentBalance + (payout.coinsRedeemed || 0);
      const refundedCashable = currentCashable + (payout.coinsRedeemed || 0);

      const ledgerEntryId = `${payoutId}_payout_cancel_${uid}`;
      tx.update(userRef, { coinBalance: refundedBalance, cashableBalance: refundedCashable, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerEntryId });
      tx.update(payoutRef, { status: "cancelled_by_user", cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
      tx.set(doc(db, "coinLedger", uid, "entries", ledgerEntryId), {
        uid,
        type: "payout_cancelled",
        amount: payout.coinsRedeemed,
        balanceAfter: refundedBalance,
        description: `Payout cancelled (refund): ₹${payout.amountRs}`,
        refId: payoutId,
        createdAt: serverTimestamp(),
      } as LedgerEntry);
      // Clear sentinel so user can request a new payout after cancellation.
      tx.set(doc(db, "payoutLock", uid), { uid, status: "idle", updatedAt: serverTimestamp() });
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

/**
 * Admin: mark payout as processed and clear the user's payoutLock sentinel.
 * Call this instead of updatePayoutStatus when the payout is finalized so the
 * user can submit a new payout request.
 */
export async function adminFinalizePayoutStatus(
  payoutId: string,
  status: "processed" | "failed",
  adminUid: string
): Promise<void> {
  await runTransaction(db, async tx => {
    const payoutRef = doc(db, "coinPayouts", payoutId);
    const payoutSnap = await tx.get(payoutRef);
    if (!payoutSnap.exists()) throw new Error("PAYOUT_NOT_FOUND");
    const { uid } = payoutSnap.data() as CoinPayout;
    tx.update(payoutRef, { status, processedBy: adminUid, processedAt: serverTimestamp() });
    // Clear sentinel so user can submit a new payout after this one is finalized.
    tx.set(doc(db, "payoutLock", uid), { uid, status: "idle", updatedAt: serverTimestamp() });
  });
}

export async function adminAdjustCoins(uid: string, amount: number, reason: string, adminUid: string, idempotencyKey: string): Promise<{ success: boolean; reason?: string }> {
  if (amount === 0) return { success: false, reason: "Amount cannot be zero" };
  if (!idempotencyKey) return { success: false, reason: "Idempotency key required" };

  try {
    await runTransaction(db, async tx => {
      const userRef = doc(db, "users", uid);
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error("USER_NOT_FOUND");

      const ledgerEntryId = `admin_${uid}_${idempotencyKey}`;
      const existingEntry = await tx.get(doc(db, "coinLedger", uid, "entries", ledgerEntryId));
      if (existingEntry.exists()) throw new Error("ALREADY_PROCESSED");

      const newBal = ((snap.data()?.coinBalance as number) ?? 0) + amount;
      if (newBal < 0) throw new Error("WOULD_GO_NEGATIVE");

      tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp(), lastLedgerEntryId: ledgerEntryId });
      tx.set(doc(db, "coinLedger", uid, "entries", ledgerEntryId), { uid, type: amount > 0 ? "admin_credit" : "admin_debit", amount, balanceAfter: newBal, description: `Admin ${amount > 0 ? "credit" : "debit"}: ${reason}`, refId: adminUid, createdAt: serverTimestamp() } as LedgerEntry);
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "ALREADY_PROCESSED") return { success: true };
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

    const totalPurchasedNC = completedPurchasesSnap.docs.reduce((sumNC, d) => sumNC + (Number(d.data()?.coinsGranted) || 0), 0);
    const totalPurchaseRevenue = completedPurchasesSnap.docs.reduce((sumRs, d) => sumRs + (Number(d.data()?.amountPaid) || 0), 0);
    const totalPayoutNC = processedPayoutsSnap.docs.reduce((sumNC, d) => sumNC + (Number(d.data()?.coinsRedeemed) || 0), 0);
    const pendingPayoutNC = pendingPayoutsSnap.docs.reduce((sumNC, d) => sumNC + (Number(d.data()?.coinsRedeemed) || 0), 0);
    const pendingPayoutCount = pendingPayoutsSnap.size;

    let totalEarnedNC = 0;
    try {
      const earnedEntriesSnap = await getDocs(
        query(collectionGroup(db, "entries"), where("type", "in", earnTypes))
      );
      totalEarnedNC = earnedEntriesSnap.docs.reduce((sumNC, d) => sumNC + (Number(d.data()?.amount) || 0), 0);
    } catch (earnError) {
      console.warn("Failed to compute totalEarnedNC fallback; defaulting to 0", earnError);
    }

    return { totalPurchasedNC, totalPurchaseRevenue, totalPayoutNC, totalEarnedNC, pendingPayoutNC, pendingPayoutCount };
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
