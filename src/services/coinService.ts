/**
 * NeighbourCoins (NC) Service
 * 1 NC = ₹1 | Spend-only within platform | Pros cash out via payout
 *
 * Firestore collections used:
 *   users/{uid}.coinBalance          — current balance (number)
 *   coinLedger/{uid}/entries/{id}    — immutable ledger per user
 *   coinPurchases/{id}               — top-up orders (RazorPay webhook target)
 *   coinPayouts/{id}                 — pro withdrawal requests
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  increment,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
export type LedgerType =
  | "topup"           // user bought coins
  | "booking_debit"   // user paid for booking
  | "booking_refund"  // booking cancelled → refund
  | "payout"          // pro cashed out
  | "earn_review"     // wrote a verified review
  | "earn_referral"   // referred a new user
  | "earn_free_consult" // pro gave free consultation
  | "earn_profile"    // completed profile
  | "earn_milestone"  // society/booking milestone
  | "earn_groupsession" // attended group session
  | "earn_ondemand"   // responded to urgent request
  | "earn_signup_bonus"; // first-time signup

export interface LedgerEntry {
  id?: string;
  uid: string;
  type: LedgerType;
  amount: number;          // positive = credit, negative = debit
  balanceAfter: number;
  description: string;
  refId?: string;          // bookingId / purchaseId etc.
  createdAt: unknown;
}

export interface CoinPurchase {
  id?: string;
  uid: string;
  amountPaid: number;      // ₹ paid
  coinsGranted: number;    // NC credited (may include bonus)
  packLabel: string;       // e.g. "Starter Pack"
  status: "pending" | "completed" | "failed";
  razorpayOrderId?: string;
  createdAt: unknown;
}

export interface CoinPayout {
  id?: string;
  uid: string;
  displayName: string;
  coinsRedeemed: number;
  amountRs: number;        // ₹ to transfer
  upiId: string;
  status: "pending" | "processed" | "failed";
  createdAt: unknown;
}

/* ─────────────────────────────────────────────
   COIN PACKS  (bonus coins incentivise larger top-ups)
───────────────────────────────────────────── */
export const COIN_PACKS = [
  { label: "Trial",    priceRs: 50,   coins: 50,   bonus: 0,  popular: false },
  { label: "Starter",  priceRs: 200,  coins: 200,  bonus: 20, popular: false },
  { label: "Popular",  priceRs: 500,  coins: 500,  bonus: 75, popular: true  },
  { label: "Pro",      priceRs: 1000, coins: 1000, bonus: 175, popular: false },
  { label: "Society",  priceRs: 2500, coins: 2500, bonus: 500, popular: false },
];

/* ─────────────────────────────────────────────
   EARN RULES
───────────────────────────────────────────── */
export const EARN_RULES: Record<LedgerType, { coins: number; label: string }> = {
  earn_signup_bonus:    { coins: 100, label: "Welcome bonus 🎉" },
  earn_profile:         { coins: 20,  label: "Profile completed" },
  earn_review:          { coins: 10,  label: "Review written" },
  earn_referral:        { coins: 100, label: "Referral reward" },
  earn_free_consult:    { coins: 50,  label: "Free consultation given" },
  earn_groupsession:    { coins: 5,   label: "Group session attended" },
  earn_ondemand:        { coins: 75,  label: "On-demand request fulfilled" },
  earn_milestone:       { coins: 50,  label: "Community milestone" },
  // these are debit/other — no earn amount
  topup:                { coins: 0,   label: "Coins purchased" },
  booking_debit:        { coins: 0,   label: "Booking payment" },
  booking_refund:       { coins: 0,   label: "Booking refund" },
  payout:               { coins: 0,   label: "Payout processed" },
};

/* ─────────────────────────────────────────────
   BALANCE HELPERS
───────────────────────────────────────────── */
export async function getCoinBalance(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", uid));
  return (snap.data()?.coinBalance as number) ?? 0;
}

/* ─────────────────────────────────────────────
   LEDGER  (append-only, never mutate)
───────────────────────────────────────────── */
async function appendLedger(entry: Omit<LedgerEntry, "id">): Promise<string> {
  const ref = await addDoc(
    collection(db, "coinLedger", entry.uid, "entries"),
    { ...entry, createdAt: serverTimestamp() }
  );
  return ref.id;
}

export async function getLedger(uid: string, pageLimit = 30): Promise<LedgerEntry[]> {
  const q = query(
    collection(db, "coinLedger", uid, "entries"),
    orderBy("createdAt", "desc"),
    limit(pageLimit)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerEntry));
}

/* ─────────────────────────────────────────────
   TOP-UP  (called after payment gateway confirms)
───────────────────────────────────────────── */
export async function topUpCoins(
  uid: string,
  priceRs: number,
  coins: number,
  packLabel: string,
  razorpayOrderId?: string
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const userRef = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);
    const currentBalance = (userSnap.data()?.coinBalance as number) ?? 0;
    const newBalance = currentBalance + coins;

    // 1. Update balance
    tx.update(userRef, { coinBalance: newBalance, updatedAt: serverTimestamp() });

    // 2. Record purchase
    const purchaseRef = doc(collection(db, "coinPurchases"));
    tx.set(purchaseRef, {
      uid,
      amountPaid: priceRs,
      coinsGranted: coins,
      packLabel,
      status: "completed",
      razorpayOrderId: razorpayOrderId ?? null,
      createdAt: serverTimestamp(),
    } as CoinPurchase);

    // 3. Ledger entry
    const ledgerRef = doc(collection(db, "coinLedger", uid, "entries"));
    tx.set(ledgerRef, {
      uid,
      type: "topup",
      amount: coins,
      balanceAfter: newBalance,
      description: `${packLabel} — ₹${priceRs} → ${coins} NC`,
      refId: purchaseRef.id,
      createdAt: serverTimestamp(),
    } as LedgerEntry);
  });
}

/* ─────────────────────────────────────────────
   BOOKING PAYMENT  (atomic debit + credit)
   Returns false if insufficient balance
───────────────────────────────────────────── */
export async function payForBooking(
  clientUid: string,
  proUid: string,
  bookingId: string,
  coins: number,           // total session fee in NC
  serviceName: string,
  platformFeePct = 0.10    // 10% platform fee
): Promise<{ success: boolean; reason?: string }> {
  const platformFee = Math.round(coins * platformFeePct);
  const proEarning  = coins - platformFee;

  try {
    await runTransaction(db, async (tx) => {
      const clientRef = doc(db, "users", clientUid);
      const proRef    = doc(db, "users", proUid);

      const [clientSnap, proSnap] = await Promise.all([
        tx.get(clientRef),
        tx.get(proRef),
      ]);

      const clientBalance = (clientSnap.data()?.coinBalance as number) ?? 0;
      if (clientBalance < coins) throw new Error("INSUFFICIENT_BALANCE");

      const proBalance = (proSnap.data()?.coinBalance as number) ?? 0;
      const newClientBal = clientBalance - coins;
      const newProBal    = proBalance + proEarning;

      // Update balances
      tx.update(clientRef, { coinBalance: newClientBal, updatedAt: serverTimestamp() });
      tx.update(proRef,    { coinBalance: newProBal,    updatedAt: serverTimestamp() });

      // Client debit ledger
      const clientLedger = doc(collection(db, "coinLedger", clientUid, "entries"));
      tx.set(clientLedger, {
        uid: clientUid, type: "booking_debit",
        amount: -coins, balanceAfter: newClientBal,
        description: `Booking: ${serviceName}`,
        refId: bookingId, createdAt: serverTimestamp(),
      } as LedgerEntry);

      // Pro credit ledger
      const proLedger = doc(collection(db, "coinLedger", proUid, "entries"));
      tx.set(proLedger, {
        uid: proUid, type: "booking_debit",
        amount: proEarning, balanceAfter: newProBal,
        description: `Earned: ${serviceName} (after 10% platform fee)`,
        refId: bookingId, createdAt: serverTimestamp(),
      } as LedgerEntry);

      // Update booking with payment info
      tx.update(doc(db, "bookings", bookingId), {
        paidInCoins: coins,
        platformFee,
        proEarning,
        coinsPaid: true,
        updatedAt: serverTimestamp(),
      });
    });

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    return {
      success: false,
      reason: msg === "INSUFFICIENT_BALANCE" ? "INSUFFICIENT_BALANCE" : "TRANSACTION_FAILED",
    };
  }
}

/* ─────────────────────────────────────────────
   REFUND  (on booking cancellation)
───────────────────────────────────────────── */
export async function refundBooking(
  clientUid: string,
  bookingId: string,
  coins: number,
  serviceName: string
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const clientRef  = doc(db, "users", clientUid);
    const clientSnap = await tx.get(clientRef);
    const balance    = (clientSnap.data()?.coinBalance as number) ?? 0;
    const newBalance = balance + coins;

    tx.update(clientRef, { coinBalance: newBalance, updatedAt: serverTimestamp() });

    const ledgerRef = doc(collection(db, "coinLedger", clientUid, "entries"));
    tx.set(ledgerRef, {
      uid: clientUid, type: "booking_refund",
      amount: coins, balanceAfter: newBalance,
      description: `Refund: ${serviceName}`,
      refId: bookingId, createdAt: serverTimestamp(),
    } as LedgerEntry);

    tx.update(doc(db, "bookings", bookingId), {
      coinsPaid: false, updatedAt: serverTimestamp(),
    });
  });
}

/* ─────────────────────────────────────────────
   EARN COINS  (generic — used for all earn events)
───────────────────────────────────────────── */
export async function earnCoins(
  uid: string,
  type: LedgerType,
  refId?: string
): Promise<void> {
  const rule = EARN_RULES[type];
  if (!rule || rule.coins === 0) return;

  // Idempotency: don't double-award same refId+type
  if (refId) {
    const existing = await getDocs(
      query(
        collection(db, "coinLedger", uid, "entries"),
        where("type", "==", type),
        where("refId", "==", refId),
        limit(1)
      )
    );
    if (!existing.empty) return;
  }

  await runTransaction(db, async (tx) => {
    const userRef  = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);
    const balance  = (userSnap.data()?.coinBalance as number) ?? 0;
    const newBal   = balance + rule.coins;

    tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });

    const ledgerRef = doc(collection(db, "coinLedger", uid, "entries"));
    tx.set(ledgerRef, {
      uid, type,
      amount: rule.coins,
      balanceAfter: newBal,
      description: rule.label,
      refId: refId ?? null,
      createdAt: serverTimestamp(),
    } as LedgerEntry);
  });
}

/* ─────────────────────────────────────────────
   PAYOUT REQUEST  (pro cashes out NC → ₹)
───────────────────────────────────────────── */
export const MIN_PAYOUT_COINS = 200; // ₹200 minimum withdrawal

export async function requestPayout(
  uid: string,
  displayName: string,
  coins: number,
  upiId: string
): Promise<{ success: boolean; reason?: string }> {
  if (coins < MIN_PAYOUT_COINS) {
    return { success: false, reason: `Minimum payout is ${MIN_PAYOUT_COINS} NC` };
  }

  try {
    await runTransaction(db, async (tx) => {
      const userRef  = doc(db, "users", uid);
      const userSnap = await tx.get(userRef);
      const balance  = (userSnap.data()?.coinBalance as number) ?? 0;

      if (balance < coins) throw new Error("INSUFFICIENT_BALANCE");

      const newBal = balance - coins;
      tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });

      // Payout request doc
      const payoutRef = doc(collection(db, "coinPayouts"));
      tx.set(payoutRef, {
        uid, displayName,
        coinsRedeemed: coins,
        amountRs: coins,   // 1 NC = ₹1
        upiId,
        status: "pending",
        createdAt: serverTimestamp(),
      } as CoinPayout);

      // Ledger
      const ledgerRef = doc(collection(db, "coinLedger", uid, "entries"));
      tx.set(ledgerRef, {
        uid, type: "payout",
        amount: -coins,
        balanceAfter: newBal,
        description: `Payout ₹${coins} → ${upiId}`,
        refId: payoutRef.id,
        createdAt: serverTimestamp(),
      } as LedgerEntry);
    });

    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    return {
      success: false,
      reason: msg === "INSUFFICIENT_BALANCE" ? "Insufficient balance" : "Transaction failed",
    };
  }
}

/* ─────────────────────────────────────────────
   ADMIN: get all pending payouts
───────────────────────────────────────────── */
export async function getPendingPayouts(): Promise<CoinPayout[]> {
  const q = query(
    collection(db, "coinPayouts"),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CoinPayout));
}

/* ─────────────────────────────────────────────
   DISPLAY HELPERS
───────────────────────────────────────────── */
export function formatNC(coins: number): string {
  return `${coins.toLocaleString("en-IN")} NC`;
}

export function ledgerColor(type: LedgerType): string {
  if (type.startsWith("earn") || type === "topup" || type === "booking_refund") return "#16a34a";
  return "#dc2626";
}

export function ledgerSign(amount: number): string {
  return amount >= 0 ? `+${amount.toLocaleString("en-IN")}` : amount.toLocaleString("en-IN");
}
