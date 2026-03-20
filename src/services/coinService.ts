import {
  collection, collectionGroup, doc, getDoc, updateDoc,
  serverTimestamp, query, orderBy, limit, getDocs, runTransaction, where,
} from "firebase/firestore";
import { db } from "../firebase";

export type LedgerType =
  | "topup" | "booking_debit" | "booking_refund" | "payout"
  | "earn_review" | "earn_referral" | "earn_free_consult" | "earn_profile"
  | "earn_milestone" | "earn_groupsession" | "earn_ondemand" | "earn_signup_bonus"
  | "admin_credit" | "admin_debit";

export interface LedgerEntry {
  id?: string;
  uid: string;
  type: LedgerType;
  amount: number;
  balanceAfter: number;
  description: string;
  refId?: string;
  createdAt: unknown;
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
  createdAt: unknown;
  completedAt?: unknown;
}

export interface CoinPayout {
  id?: string;
  uid: string;
  displayName: string;
  coinsRedeemed: number;
  amountRs: number;
  upiId: string;
  status: "pending" | "processed" | "failed";
  processedBy?: string;
  processedAt?: unknown;
  createdAt: unknown;
}

export const COIN_PACKS = [
  { label: "Trial",   priceRs: 50,   coins: 50,   bonus: 0,   popular: false },
  { label: "Starter", priceRs: 200,  coins: 200,  bonus: 20,  popular: false },
  { label: "Popular", priceRs: 500,  coins: 500,  bonus: 75,  popular: true  },
  { label: "Pro",     priceRs: 1000, coins: 1000, bonus: 175, popular: false },
  { label: "Society", priceRs: 2500, coins: 2500, bonus: 500, popular: false },
];

export const EARN_RULES: Record<LedgerType, { coins: number; label: string }> = {
  earn_signup_bonus:  { coins: 100, label: "Welcome bonus 🎉" },
  earn_profile:       { coins: 20,  label: "Profile completed" },
  earn_review:        { coins: 10,  label: "Review written" },
  earn_referral:      { coins: 100, label: "Referral reward" },
  earn_free_consult:  { coins: 50,  label: "Free consultation given" },
  earn_groupsession:  { coins: 5,   label: "Group session attended" },
  earn_ondemand:      { coins: 75,  label: "On-demand request fulfilled" },
  earn_milestone:     { coins: 50,  label: "Community milestone" },
  topup:              { coins: 0,   label: "Coins purchased" },
  booking_debit:      { coins: 0,   label: "Booking payment" },
  booking_refund:     { coins: 0,   label: "Booking refund" },
  payout:             { coins: 0,   label: "Payout processed" },
  admin_credit:       { coins: 0,   label: "Admin credit" },
  admin_debit:        { coins: 0,   label: "Admin debit" },
};

export async function getCoinBalance(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", uid));
  return (snap.data()?.coinBalance as number) ?? 0;
}

export async function getLedger(uid: string, pageLimit = 30): Promise<LedgerEntry[]> {
  const q = query(collection(db, "coinLedger", uid, "entries"), orderBy("createdAt", "desc"), limit(pageLimit));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry));
}

export async function topUpCoins(uid: string, priceRs: number, coins: number, packLabel: string, paymentId?: string): Promise<void> {
  await runTransaction(db, async tx => {
    const userRef = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);
    const newBal = ((userSnap.data()?.coinBalance as number) ?? 0) + coins;
    tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
    const purchaseRef = doc(collection(db, "coinPurchases"));
    tx.set(purchaseRef, { uid, amountPaid: priceRs, coinsGranted: coins, packLabel, status: "completed", paymentId: paymentId ?? null, createdAt: serverTimestamp(), completedAt: serverTimestamp() } as CoinPurchase);
    const lr = doc(collection(db, "coinLedger", uid, "entries"));
    tx.set(lr, { uid, type: "topup", amount: coins, balanceAfter: newBal, description: `${packLabel} Pack — ₹${priceRs} → ${coins} NC`, refId: purchaseRef.id, createdAt: serverTimestamp() } as LedgerEntry);
  });
}

export async function payForBooking(clientUid: string, proUid: string, bookingId: string, coins: number, serviceName: string, platformFeePct = 0.10): Promise<{ success: boolean; reason?: string }> {
  const platformFee = Math.round(coins * platformFeePct);
  const proEarning  = coins - platformFee;
  try {
    await runTransaction(db, async tx => {
      const clientRef = doc(db, "users", clientUid);
      const proRef    = doc(db, "users", proUid);
      const [cs, ps]  = await Promise.all([tx.get(clientRef), tx.get(proRef)]);
      const clientBal = (cs.data()?.coinBalance as number) ?? 0;
      if (clientBal < coins) throw new Error("INSUFFICIENT_BALANCE");
      const proBal = (ps.data()?.coinBalance as number) ?? 0;
      tx.update(clientRef, { coinBalance: clientBal - coins, updatedAt: serverTimestamp() });
      tx.update(proRef,    { coinBalance: proBal + proEarning, updatedAt: serverTimestamp() });
      tx.set(doc(collection(db, "coinLedger", clientUid, "entries")), { uid: clientUid, type: "booking_debit", amount: -coins, balanceAfter: clientBal - coins, description: `Booking: ${serviceName}`, refId: bookingId, createdAt: serverTimestamp() } as LedgerEntry);
      tx.set(doc(collection(db, "coinLedger", proUid, "entries")), { uid: proUid, type: "booking_debit", amount: proEarning, balanceAfter: proBal + proEarning, description: `Earned: ${serviceName} (after 10% fee)`, refId: bookingId, createdAt: serverTimestamp() } as LedgerEntry);
      tx.update(doc(db, "bookings", bookingId), { paidInCoins: coins, platformFee, proEarning, coinsPaid: true, updatedAt: serverTimestamp() });
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    return { success: false, reason: msg === "INSUFFICIENT_BALANCE" ? "INSUFFICIENT_BALANCE" : "TRANSACTION_FAILED" };
  }
}

export async function refundBooking(clientUid: string, bookingId: string, coins: number, serviceName: string): Promise<void> {
  await runTransaction(db, async tx => {
    const userRef = doc(db, "users", clientUid);
    const snap    = await tx.get(userRef);
    const newBal  = ((snap.data()?.coinBalance as number) ?? 0) + coins;
    tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
    tx.set(doc(collection(db, "coinLedger", clientUid, "entries")), { uid: clientUid, type: "booking_refund", amount: coins, balanceAfter: newBal, description: `Refund: ${serviceName}`, refId: bookingId, createdAt: serverTimestamp() } as LedgerEntry);
    tx.update(doc(db, "bookings", bookingId), { coinsPaid: false, updatedAt: serverTimestamp() });
  });
}

export async function earnCoins(uid: string, type: LedgerType, refId?: string): Promise<void> {
  const rule = EARN_RULES[type];
  if (!rule || rule.coins === 0) return;
  if (refId) {
    const existing = await getDocs(query(collection(db, "coinLedger", uid, "entries"), where("type", "==", type), where("refId", "==", refId), limit(1)));
    if (!existing.empty) return;
  }
  await runTransaction(db, async tx => {
    const userRef = doc(db, "users", uid);
    const snap    = await tx.get(userRef);
    const newBal  = ((snap.data()?.coinBalance as number) ?? 0) + rule.coins;
    tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
    tx.set(doc(collection(db, "coinLedger", uid, "entries")), { uid, type, amount: rule.coins, balanceAfter: newBal, description: rule.label, refId: refId ?? null, createdAt: serverTimestamp() } as LedgerEntry);
  });
}

export const MIN_PAYOUT_COINS = 200;

export async function requestPayout(uid: string, displayName: string, coins: number, upiId: string): Promise<{ success: boolean; reason?: string }> {
  if (coins < MIN_PAYOUT_COINS) return { success: false, reason: `Minimum payout is ${MIN_PAYOUT_COINS} NC` };
  try {
    await runTransaction(db, async tx => {
      const userRef = doc(db, "users", uid);
      const snap    = await tx.get(userRef);
      const balance = (snap.data()?.coinBalance as number) ?? 0;
      if (balance < coins) throw new Error("INSUFFICIENT_BALANCE");
      const newBal  = balance - coins;
      tx.update(userRef, { coinBalance: newBal, updatedAt: serverTimestamp() });
      const payoutRef = doc(collection(db, "coinPayouts"));
      tx.set(payoutRef, { uid, displayName, coinsRedeemed: coins, amountRs: coins, upiId, status: "pending", createdAt: serverTimestamp() } as CoinPayout);
      tx.set(doc(collection(db, "coinLedger", uid, "entries")), { uid, type: "payout", amount: -coins, balanceAfter: newBal, description: `Payout ₹${coins} → ${upiId}`, refId: payoutRef.id, createdAt: serverTimestamp() } as LedgerEntry);
    });
    return { success: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    return { success: false, reason: msg === "INSUFFICIENT_BALANCE" ? "Insufficient balance" : "Transaction failed" };
  }
}

/* ══ ADMIN ══ */

export async function getAllCoinPurchases(pageLimit = 100): Promise<CoinPurchase[]> {
  const snap = await getDocs(query(collection(db, "coinPurchases"), orderBy("createdAt", "desc"), limit(pageLimit)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CoinPurchase));
}

export async function getAllPayouts(pageLimit = 100): Promise<CoinPayout[]> {
  const snap = await getDocs(query(collection(db, "coinPayouts"), orderBy("createdAt", "desc"), limit(pageLimit)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CoinPayout));
}

export async function getPendingPayouts(): Promise<CoinPayout[]> {
  const snap = await getDocs(query(collection(db, "coinPayouts"), where("status", "==", "pending"), orderBy("createdAt", "asc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CoinPayout));
}

export async function updatePayoutStatus(payoutId: string, status: "processed" | "failed", adminUid: string): Promise<void> {
  await updateDoc(doc(db, "coinPayouts", payoutId), { status, processedBy: adminUid, processedAt: serverTimestamp() });
}

export async function adminAdjustCoins(uid: string, amount: number, reason: string, adminUid: string): Promise<{ success: boolean; reason?: string }> {
  if (amount === 0) return { success: false, reason: "Amount cannot be zero" };
  try {
    await runTransaction(db, async tx => {
      const userRef = doc(db, "users", uid);
      const snap    = await tx.get(userRef);
      if (!snap.exists()) throw new Error("USER_NOT_FOUND");
      const newBal  = ((snap.data()?.coinBalance as number) ?? 0) + amount;
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

export async function getCoinEconomySummary(): Promise<{
  totalPurchasedNC: number; totalPurchaseRevenue: number;
  totalPayoutNC: number; totalEarnedNC: number;
  pendingPayoutNC: number; pendingPayoutCount: number;
}> {
  const [purchases, payouts, earnedSnap] = await Promise.all([
    getAllCoinPurchases(500),
    getAllPayouts(500),
    // Fix: use collectionGroup to sum all earn_* entries across all users
    getDocs(query(
      collectionGroup(db, "entries"),
      where("type", "in", [
        "earn_signup_bonus","earn_profile","earn_review","earn_referral",
        "earn_free_consult","earn_groupsession","earn_ondemand","earn_milestone",
      ])
    )),
  ]);

  const totalPurchasedNC    = purchases.filter(p => p.status === "completed").reduce((s, p) => s + p.coinsGranted, 0);
  const totalPurchaseRevenue = purchases.filter(p => p.status === "completed").reduce((s, p) => s + p.amountPaid, 0);
  const totalPayoutNC       = payouts.filter(p => p.status === "processed").reduce((s, p) => s + p.coinsRedeemed, 0);
  const pendingPayouts      = payouts.filter(p => p.status === "pending");
  const totalEarnedNC       = earnedSnap.docs.reduce((s, d) => s + ((d.data().amount as number) || 0), 0);

  return {
    totalPurchasedNC, totalPurchaseRevenue, totalPayoutNC, totalEarnedNC,
    pendingPayoutNC:    pendingPayouts.reduce((s, p) => s + p.coinsRedeemed, 0),
    pendingPayoutCount: pendingPayouts.length,
  };
}

export { getLedger as adminGetLedger };

export function formatNC(coins: number): string { return `${coins.toLocaleString("en-IN")} NC`; }
export function ledgerColor(type: LedgerType): string {
  return type.startsWith("earn") || type === "topup" || type === "booking_refund" || type === "admin_credit" ? "#16a34a" : "#dc2626";
}
export function ledgerSign(amount: number): string {
  return amount >= 0 ? `+${amount.toLocaleString("en-IN")}` : amount.toLocaleString("en-IN");
}
