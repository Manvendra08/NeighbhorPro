import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { db } from "../firebase";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SubscriptionStatus =
  | "trial"
  | "trial_ending"
  | "active"
  | "renewing"
  | "past_due"
  | "grace"
  | "expired"
  | "cancelled"
  | "comped"
  | "paused";

export type SubscriptionSource = "trial" | "coins" | "comp" | "admin_grant";

export type PlanId =
  | "business_trial_v1"
  | "business_3m_v1"
  | "business_6m_v1"
  | "business_12m_v1";

export interface SubPlan {
  id: PlanId;
  label: string;
  durationDays: number;
  priceNC: number;
  badgeLabel?: string;
}

export const SUB_PLANS: SubPlan[] = [
  { id: "business_3m_v1", label: "3 Months", durationDays: 90, priceNC: 999 },
  {
    id: "business_6m_v1",
    label: "6 Months",
    durationDays: 180,
    priceNC: 1799,
    badgeLabel: "Best value",
  },
  {
    id: "business_12m_v1",
    label: "12 Months",
    durationDays: 365,
    priceNC: 2299,
  },
];

export interface Subscription {
  id?: string;
  uid: string;
  plan: PlanId;
  status: SubscriptionStatus;
  currency: "NC" | "free";
  amount: number;
  currentPeriodStart: unknown; // Firestore Timestamp
  currentPeriodEnd: unknown; // Firestore Timestamp
  cancelAtPeriodEnd: boolean;
  lastInvoiceId?: string;
  source: SubscriptionSource;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface SubInvoice {
  id?: string;
  subId: string;
  uid: string;
  plan: PlanId;
  periodStart: unknown;
  periodEnd: unknown;
  amount: number;
  currency: "NC" | "free";
  paidAt: unknown;
  paymentMethod: "coins" | "comp" | "trial";
  ledgerEntryId?: string;
  status: "paid" | "comp" | "trial";
}

// ─── Config-driven plan loader ───────────────────────────────────────────────

/**
 * Load subscription plan prices from admin-controlled Firestore config.
 * Falls back to hardcoded SUB_PLANS defaults if config is unavailable.
 */
export async function getSubPlansFromConfig(): Promise<SubPlan[]> {
  try {
    const snap = await getDoc(doc(db, "config", "platformSettings"));
    if (!snap.exists()) return SUB_PLANS;
    const data = snap.data();
    const overrides: Partial<Record<PlanId, Partial<SubPlan>>> = {
      business_3m_v1:  { priceNC: (data.sub3mPriceNC  as number) || undefined },
      business_6m_v1:  { priceNC: (data.sub6mPriceNC  as number) || undefined },
      business_12m_v1: { priceNC: (data.sub12mPriceNC as number) || undefined },
    };
    return SUB_PLANS.map(plan => {
      const override = overrides[plan.id];
      if (!override?.priceNC) return plan;
      return { ...plan, priceNC: override.priceNC };
    });
  } catch {
    return SUB_PLANS;
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

const PAID_PLAN_IDS: [PlanId, ...PlanId[]] = [
  "business_3m_v1",
  "business_6m_v1",
  "business_12m_v1",
];

const subscribeNCSchema = z.object({
  uid: z.string().min(1),
  planId: z.enum(PAID_PLAN_IDS),
});

// ─── Utility helpers ─────────────────────────────────────────────────────────

function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (ts instanceof Timestamp) return ts.toDate();
  if (
    typeof ts === "object" &&
    ts !== null &&
    "seconds" in ts &&
    typeof (ts as { seconds: number }).seconds === "number"
  ) {
    return new Date((ts as { seconds: number }).seconds * 1000);
  }
  return null;
}

export function daysRemaining(sub: Subscription | null): number {
  if (!sub) return 0;
  const end = toDate(sub.currentPeriodEnd);
  if (!end) return 0;
  const msLeft = end.getTime() - Date.now();
  return Math.ceil(msLeft / 86_400_000);
}

export function computeSubState(sub: Subscription | null): SubscriptionStatus {
  if (!sub) return "expired";

  const end = toDate(sub.currentPeriodEnd);
  const now = new Date();

  if (!end || end < now) return "expired";

  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);

  if (sub.status === "trial" || sub.status === "trial_ending") {
    return days <= 7 ? "trial_ending" : "trial";
  }

  if (sub.status === "active" || sub.status === "renewing") {
    return days <= 7 ? "renewing" : "active";
  }

  if (sub.status === "expired") return "expired";

  return sub.status;
}

export function isSubActive(sub: Subscription | null): boolean {
  const state = computeSubState(sub);
  return (
    state === "trial" ||
    state === "trial_ending" ||
    state === "active" ||
    state === "renewing" ||
    state === "past_due" ||
    state === "grace" ||
    state === "comped"
  );
}

// ─── Firebase operations ──────────────────────────────────────────────────────

export async function getSubscription(uid: string): Promise<Subscription | null> {
  const q = query(
    collection(db, "subscriptions"),
    where("uid", "==", uid),
    where("status", "not-in", ["expired", "cancelled"]),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  const snap = await getDocs(q);

  if (!snap.empty) {
    const docSnap = snap.docs[0];
    return { id: docSnap.id, ...(docSnap.data() as Omit<Subscription, "id">) };
  }

  // Fallback: read denorm field on user doc
  const userSnap = await getDocs(
    query(collection(db, "users"), where("__name__", "==", uid), limit(1))
  );

  if (!userSnap.empty) {
    const userData = userSnap.docs[0].data();
    const denorm = userData?.subscription as Subscription | undefined;
    if (
      denorm &&
      denorm.status &&
      !["expired", "cancelled"].includes(denorm.status)
    ) {
      return { ...denorm, uid };
    }
  }

  return null;
}

export async function getAllSubscriptionInvoices(uid: string): Promise<SubInvoice[]> {
  const q = query(
    collection(db, "subscriptionInvoices"),
    where("uid", "==", uid),
    orderBy("paidAt", "desc"),
    limit(12)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SubInvoice, "id">) }));
}

export async function activateTrial(uid: string): Promise<Subscription> {
  return runTransaction(db, async tx => {
    const userRef = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);

    if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

    const userData = userSnap.data();

    if (userData.trialUsed === true) throw new Error("TRIAL_ALREADY_USED");

    // Check for any existing active subscription
    const activeSubSnap = await getDocs(
      query(
        collection(db, "subscriptions"),
        where("uid", "==", uid),
        where("status", "not-in", ["expired", "cancelled"]),
        limit(1)
      )
    );

    if (!activeSubSnap.empty) throw new Error("ACTIVE_SUB_EXISTS");

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86_400_000);
    const periodEndTs = Timestamp.fromDate(periodEnd);
    const nowTs = Timestamp.fromDate(now);

    const subId = `sub_${uid}_trial`;
    const subRef = doc(db, "subscriptions", subId);
    const invRef = doc(db, "subscriptionInvoices", `inv_trial_${uid}`);

    const sub: Omit<Subscription, "id"> = {
      uid,
      plan: "business_trial_v1",
      status: "trial",
      currency: "free",
      amount: 0,
      currentPeriodStart: nowTs,
      currentPeriodEnd: periodEndTs,
      cancelAtPeriodEnd: false,
      source: "trial",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const invoice: Omit<SubInvoice, "id"> = {
      subId,
      uid,
      plan: "business_trial_v1",
      periodStart: nowTs,
      periodEnd: periodEndTs,
      amount: 0,
      currency: "free",
      paidAt: serverTimestamp(),
      paymentMethod: "trial",
      status: "trial",
    };

    tx.set(subRef, sub);
    tx.set(invRef, invoice);
    tx.update(userRef, {
      trialUsed: true,
      subscription: {
        status: "trial",
        currentPeriodEnd: periodEndTs,
        plan: "business_trial_v1",
        trialUsed: true,
        cancelAtPeriodEnd: false,
      },
      updatedAt: serverTimestamp(),
    });

    return { id: subId, ...sub };
  });
}

export async function subscribeWithNC(uid: string, planId: PlanId): Promise<Subscription> {
  subscribeNCSchema.parse({ uid, planId });

  const plan = SUB_PLANS.find(p => p.id === planId);
  if (!plan) throw new Error("INVALID_PLAN");

  return runTransaction(db, async tx => {
    const userRef = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);

    if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

    const userData = userSnap.data();
    const cashableBalance: number = (userData.cashableBalance as number) ?? 0;
    const price = plan.priceNC;

    if (cashableBalance < price) throw new Error("INSUFFICIENT_CASHABLE_BALANCE");

    // Check for existing active/trial/comped subscription
    const existingSubSnap = await getDocs(
      query(
        collection(db, "subscriptions"),
        where("uid", "==", uid),
        where("status", "not-in", ["expired", "cancelled"]),
        limit(1)
      )
    );

    if (!existingSubSnap.empty) {
      const existingSub = existingSubSnap.docs[0].data() as Subscription;
      const end = toDate(existingSub.currentPeriodEnd);
      if (end && end > new Date()) {
        throw new Error("ACTIVE_SUB_EXISTS");
      }
    }

    const ledgerEntryId = `sub_debit_${uid}_${Date.now()}`;
    const ledgerRef = doc(db, "coinLedger", uid, "entries", ledgerEntryId);
    const ledgerSnap = await tx.get(ledgerRef);

    if (ledgerSnap.exists()) throw new Error("DUPLICATE_LEDGER_ENTRY");

    const now = new Date();
    const periodEnd = new Date(now.getTime() + plan.durationDays * 86_400_000);
    const periodEndTs = Timestamp.fromDate(periodEnd);
    const nowTs = Timestamp.fromDate(now);
    const newCashable = cashableBalance - price;

    const subId = `sub_${uid}_${ledgerEntryId}`;
    const subRef = doc(db, "subscriptions", subId);
    const invRef = doc(db, "subscriptionInvoices", `inv_${ledgerEntryId}`);

    tx.set(ledgerRef, {
      uid,
      type: "subscription_debit",
      amount: -price,
      balanceAfter: newCashable,
      description: `Business Listing — ${plan.label}`,
      createdAt: serverTimestamp(),
    });

    const sub: Omit<Subscription, "id"> = {
      uid,
      plan: planId,
      status: "active",
      currency: "NC",
      amount: price,
      currentPeriodStart: nowTs,
      currentPeriodEnd: periodEndTs,
      cancelAtPeriodEnd: false,
      lastInvoiceId: `inv_${ledgerEntryId}`,
      source: "coins",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const invoice: Omit<SubInvoice, "id"> = {
      subId,
      uid,
      plan: planId,
      periodStart: nowTs,
      periodEnd: periodEndTs,
      amount: price,
      currency: "NC",
      paidAt: serverTimestamp(),
      paymentMethod: "coins",
      ledgerEntryId,
      status: "paid",
    };

    tx.set(subRef, sub);
    tx.set(invRef, invoice);
    tx.update(userRef, {
      cashableBalance: newCashable,
      subscription: {
        status: "active",
        currentPeriodEnd: periodEndTs,
        plan: planId,
        trialUsed: true,
        cancelAtPeriodEnd: false,
      },
      updatedAt: serverTimestamp(),
    });

    return { id: subId, ...sub };
  });
}

export async function cancelSubscription(uid: string): Promise<void> {
  const activeSub = await getSubscription(uid);
  if (!activeSub?.id) throw new Error("NO_ACTIVE_SUBSCRIPTION");

  const subRef = doc(db, "subscriptions", activeSub.id);
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async tx => {
    tx.update(subRef, { cancelAtPeriodEnd: true, updatedAt: serverTimestamp() });
    tx.update(userRef, {
      "subscription.cancelAtPeriodEnd": true,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function resumeSubscription(uid: string): Promise<void> {
  const activeSub = await getSubscription(uid);
  if (!activeSub?.id) throw new Error("NO_ACTIVE_SUBSCRIPTION");
  if (!activeSub.cancelAtPeriodEnd) throw new Error("SUBSCRIPTION_NOT_CANCELLED");

  const subRef = doc(db, "subscriptions", activeSub.id);
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async tx => {
    tx.update(subRef, { cancelAtPeriodEnd: false, updatedAt: serverTimestamp() });
    tx.update(userRef, {
      "subscription.cancelAtPeriodEnd": false,
      updatedAt: serverTimestamp(),
    });
  });
}
