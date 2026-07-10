# ProNeighbor: Subscription & Monetization Strategy

> **Version**: 1.1 | **Last Updated**: June 29, 2026 | **Status**: Production-Ready

---

## Executive Summary

The **Options Engine** (Subscription & Monetization System) is ProNeighbor's revenue engine for professional service listings. It implements a tiered subscription model where business-category professionals must maintain an active subscription to keep their listings visible. The system uses NeighbourCoins (NC) as the sole currency, with server-side debit via Cloud Functions to ensure atomicity and prevent fraud.

### Key Capabilities
- **Tiered Pricing**: 3-month, 6-month, and 12-month plans with volume discounts
- **Free Trial**: 30-day trial for first-time business listing subscribers
- **Automated Lifecycle**: Renewal reminders, grace periods, and expiry processing
- **Admin Controls**: Complimentary subscriptions, pauses, force-cancellations
- **Business Category Gating**: Automatic listing pause when subscription expires
- **Revenue Model**: NC-only payments drive coin purchases and platform engagement

---

## Subscription Engine Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUBSCRIPTION ENGINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │  Client Layer    │    │  Service Layer   │    │  Backend Layer   │      │
│  │                  │    │                  │    │                  │      │
│  │  Subscription-   │    │  subscription-   │    │  Cloud Functions │      │
│  │  Manage.tsx      │◀──▶│  Service.ts      │◀──▶│  ├─ subscribe-   │      │
│  │                  │    │                  │    │  │  WithNCCallable│      │
│  │  - Plan selection│    │  - activateTrial │    │  ├─ activate-    │      │
│  │  - Trial signup  │    │  - subscribeWith │    │  │  TrialCallable │      │
│  │  - Renewal       │    │    NC            │    │  ├─ daily-       │      │
│  │  - Cancellation  │    │  - cancelSub-    │    │  │  RenewalSweep  │      │
│  │                  │    │    scription     │    │  └─ adminSub-    │      │
│  └──────────────────┘    └──────────────────┘    │    scriptionAction│      │
│                                                   └──────────────────┘      │
│                                                              │               │
│                                                              ▼               │
│                                                   ┌──────────────────┐      │
│                                                   │  Data Layer      │      │
│                                                   │                  │      │
│                                                   │  - subscriptions │      │
│                                                   │  - subscription- │      │
│                                                   │    Invoices      │      │
│                                                   │  - coinLedger    │      │
│                                                   │  - users (denorm)│      │
│                                                   │  - services      │      │
│                                                   │    (subStatus)   │      │
│                                                   └──────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User selects plan
  → Client validates plan ID
  → Call subscribeWithNCCallable (Cloud Function)
  → Cloud Function runs transaction:
      1. Check cashableBalance >= plan.priceNC
      2. Check no active subscription exists
      3. Debit cashableBalance
      4. Create subscription document
      5. Create invoice document
      6. Write ledger entry (type: subscription_debit)
      7. Update user.subscription (denormalized)
      8. Restore paused business listings
  → Return success with subscription ID
  → Client shows success message
  → React Query invalidates subscription cache
```

---

## Plan Definitions & Pricing Strategy

### Plan Catalog

| Plan ID | Label | Duration | Price (NC) | Monthly Effective | Badge |
|---------|-------|----------|------------|-------------------|-------|
| `business_trial_v1` | Free Trial | 30 days | 0 | 0 | — |
| `business_3m_v1` | 3 Months | 90 days | 999 | 333/mo | — |
| `business_6m_v1` | 6 Months | 180 days | 1799 | 300/mo | ✨ Best value |
| `business_12m_v1` | 12 Months | 365 days | 2299 | 192/mo | — |

### Pricing Strategy

**Volume Discounts**:
- 3-month: Base rate (333 NC/month)
- 6-month: 10% discount (300 NC/month) → Save 199 NC
- 12-month: 42% discount (192 NC/month) → Save 1699 NC

**Psychological Pricing**:
- 999 NC feels less than 1000 NC
- 1799 NC for 6 months vs 1998 NC (2 × 999) → 199 NC savings
- 2299 NC for 12 months vs 3996 NC (4 × 999) → 1697 NC savings

**Revenue Projections** (per 1000 subscribers):
- Assume 60% choose 6-month, 30% choose 12-month, 10% choose 3-month
- Revenue: 600 × 1799 + 300 × 2299 + 100 × 999 = 1,079,400 + 689,700 + 99,900 = **1,869,000 NC**
- At 1 NC = ₹1: **₹18,69,000** (~$22,400 USD)

### Dynamic Pricing (Admin-Configurable)

Prices can be adjusted via `config/platformSettings`:
```typescript
{
  sub3mPriceNC: 999,
  sub6mPriceNC: 1799,
  sub12mPriceNC: 2299
}
```

**Client-Side Loading**:
```typescript
export async function getSubPlansFromConfig(): Promise<SubPlan[]> {
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
}
```

---

## Business Categories (Subscription-Gated)

### Category Groups

```typescript
export const CATEGORY_GROUPS: Record<string, string[]> = {
  "Business": [
    "Tuition & Coaching",
    "Yoga & Fitness",
    "Music & Dance",
    "Language Classes",
    "Nutrition & Diet",
  ],
  "Services": [
    "Tax & CA",
    "Legal Advisory",
    "Accounting & GST",
    "Investment Planning",
    "Career Coaching",
    "Digital Marketing",
    "Resume & LinkedIn",
    "Homeopathy Doctor",
    "Beauty & Grooming",
    "Professional Services",
    "Design & Branding",
  ],
};
```

### Gating Logic

**Business categories require active subscription**:
```typescript
export function isBusinessCategory(category: string): boolean {
  return getCategoryGroup(category) === "Business";
}

// In service creation
if (isBusinessCategory(data.category as string)) {
  const userDoc = await getDoc(doc(db, "users", data.userId as string));
  const sub = userDoc.data()?.subscription;
  if (
    !sub ||
    !["trial", "trial_ending", "active", "renewing", "past_due", "grace", "comped"].includes(sub.status) ||
    (sub.currentPeriodEnd?.toMillis() ?? 0) <= Date.now()
  ) {
    throw new Error("Business category requires an active subscription");
  }
}
```

**Listing Pause on Expiry**:
```typescript
// Cloud Function: dailyRenewalSweep
async function pauseBusinessListings(uid: string): Promise<void> {
  const servicesSnap = await db
    .collection("services")
    .where("userId", "==", uid)
    .where("category", "in", BUSINESS_CATEGORIES)
    .get();

  if (servicesSnap.empty) return;

  const batch = db.batch();
  servicesSnap.docs.forEach(d => {
    batch.update(d.ref, { 
      subStatus: "paused_subscription", 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });
  });
  await batch.commit();
}
```

**Listing Restoration on Renewal**:
```typescript
async function restoreBusinessListings(uid: string): Promise<void> {
  const servicesSnap = await db
    .collection("services")
    .where("userId", "==", uid)
    .where("subStatus", "==", "paused_subscription")
    .get();

  if (servicesSnap.empty) return;

  const batch = db.batch();
  servicesSnap.docs.forEach(d => {
    batch.update(d.ref, { 
      subStatus: "active", 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    });
  });
  await batch.commit();
}
```

---

## Trial Activation Flow

### Trial Eligibility

**Rules**:
1. One trial per user (tracked via `users/{uid}.trialUsed`)
2. No active subscription allowed
3. Trial duration: 30 days (hardcoded)
4. Trial status: `trial` → `trial_ending` (T-7 days) → `expired`

### Activation Sequence

```
User clicks "Start Free Trial"
  → Client calls activateTrialCallable (Cloud Function)
  → Cloud Function runs transaction:
      1. Check trialUsed != true
      2. Check no active subscription exists
      3. Create subscription document (status: "trial")
      4. Create invoice document (status: "trial", amount: 0)
      5. Update user.trialUsed = true
      6. Update user.subscription (denormalized)
  → Return success with subscription ID
  → Client shows success message
  → Business listings become visible
```

### Implementation (Cloud Function)

```typescript
export const activateTrialCallable = functions.onCall(
  { region: "asia-south1" },
  async (request: any) => {
    const callerUid: string = request.auth?.uid;
    if (!callerUid) throw new functions.HttpsError("unauthenticated", "Must be signed in.");

    const { uid } = request.data as { uid?: string };
    if (!uid || uid !== callerUid) {
      throw new functions.HttpsError("permission-denied", "UID mismatch.");
    }

    try {
      const result = await db.runTransaction(async tx => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) throw new functions.HttpsError("not-found", "User not found.");

        const userData = userSnap.data();
        if (userData.trialUsed === true) {
          throw new functions.HttpsError("already-exists", "TRIAL_ALREADY_USED");
        }

        const existingSnap = await db
          .collection("subscriptions")
          .where("uid", "==", uid)
          .where("status", "not-in", ["expired", "cancelled"])
          .limit(1)
          .get();

        if (!existingSnap.empty) {
          throw new functions.HttpsError("already-exists", "ACTIVE_SUB_EXISTS");
        }

        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 86_400_000);
        const periodEndTs = Timestamp.fromDate(periodEnd);
        const nowTs = Timestamp.fromDate(now);
        const subId = `sub_${uid}_trial`;

        tx.set(db.collection("subscriptions").doc(subId), {
          uid, plan: "business_trial_v1", status: "trial", currency: "free",
          amount: 0,
          currentPeriodStart: nowTs, currentPeriodEnd: periodEndTs,
          cancelAtPeriodEnd: false, source: "trial",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.set(db.collection("subscriptionInvoices").doc(`inv_trial_${uid}`), {
          subId, uid, plan: "business_trial_v1",
          periodStart: nowTs, periodEnd: periodEndTs,
          amount: 0, currency: "free",
          paidAt: FieldValue.serverTimestamp(),
          paymentMethod: "trial", status: "trial",
        });

        tx.update(userRef, {
          trialUsed: true,
          subscription: {
            status: "trial",
            currentPeriodEnd: periodEndTs,
            plan: "business_trial_v1",
            trialUsed: true,
            cancelAtPeriodEnd: false,
          },
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { subId, periodEnd: periodEnd.toISOString() };
      });

      return result;
    } catch (err: unknown) {
      if (err instanceof functions.HttpsError) throw err;
      logger.error("activateTrialCallable error", err);
      throw new functions.HttpsError("internal", "Failed to activate trial.");
    }
  }
);
```

### Client-Side Implementation

```typescript
export async function activateTrial(uid: string): Promise<Subscription> {
  return runTransaction(db, async tx => {
    const userRef = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);

    if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

    const userData = userSnap.data();

    if (userData.trialUsed === true) throw new Error("TRIAL_ALREADY_USED");

    const trialSubId = `sub_${uid}_trial`;
    const trialSubRef = doc(db, "subscriptions", trialSubId);
    const trialSubSnap = await tx.get(trialSubRef);

    if (trialSubSnap.exists()) {
      const existingSub = trialSubSnap.data() as Subscription;
      const end = toDate(existingSub.currentPeriodEnd);
      if (end && end > new Date()) {
        throw new Error("ACTIVE_SUB_EXISTS");
      }
    }

    const now = new Date();
    const periodEnd = addDaysDSTSafe(now, 30);
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
  }).then(result => {
    captureAuditEvent({
      action: "subscription_activated",
      adminId: "system",
      adminName: "System",
      details: `Trial subscription activated for user ${uid}`,
      targetId: uid,
      metadata: {
        plan: "business_trial_v1",
        source: "trial",
        amount: 0,
        currency: "free",
      },
    }).catch((err: unknown) => {
      captureError(err, { operation: "audit_log_subscription_activated", uid });
    });
    return result;
  });
}
```

---

## Subscription Purchase Flow (NC Debit)

### Purchase Sequence

```
User selects paid plan
  → Client validates plan ID and cashableBalance
  → Call subscribeWithNCCallable (Cloud Function)
  → Cloud Function runs transaction:
      1. Check cashableBalance >= plan.priceNC
      2. Check no active subscription exists
      3. Generate deterministic ledger entry ID (idempotency)
      4. Debit cashableBalance and coinBalance
      5. Create subscription document (status: "active")
      6. Create invoice document (status: "paid")
      7. Write ledger entry (type: subscription_debit)
      8. Update user.subscription (denormalized)
      9. Restore paused business listings
  → Return success with subscription ID
  → Client shows success message
  → React Query invalidates subscription and balance caches
```

### Implementation (Cloud Function)

```typescript
export const subscribeWithNCCallable = functions.onCall(
  { region: "asia-south1" },
  async (request: any) => {
    const callerUid: string = request.auth?.uid;
    if (!callerUid) throw new functions.HttpsError("unauthenticated", "Must be signed in.");

    const { uid, planId } = request.data as { uid?: string; planId?: string };

    if (!uid || uid !== callerUid) {
      throw new functions.HttpsError("permission-denied", "UID mismatch.");
    }
    if (!planId || !PAID_PLANS[planId]) {
      throw new functions.HttpsError("invalid-argument", "Invalid plan ID.");
    }

    const plan = PAID_PLANS[planId];

    try {
      const subDoc = await db.runTransaction(async tx => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) throw new functions.HttpsError("not-found", "User not found.");

        const userData = userSnap.data()!;
        const cashable: number = (userData.cashableBalance as number) ?? 0;

        if (cashable < plan.priceNC) {
          throw new functions.HttpsError("resource-exhausted", "INSUFFICIENT_CASHABLE_BALANCE");
        }

        // Idempotency + active-sub guard
        const existingSnap = await db
          .collection("subscriptions")
          .where("uid", "==", uid)
          .where("status", "not-in", ["expired", "cancelled"])
          .limit(1)
          .get();

        if (!existingSnap.empty) {
          const existingSub = existingSnap.docs[0].data();
          const end = (existingSub.currentPeriodEnd as Timestamp)?.toDate();
          if (end && end > new Date()) {
            throw new functions.HttpsError("already-exists", "ACTIVE_SUB_EXISTS");
          }
        }

        const ledgerEntryId = `sub_debit_${uid}_${Date.now()}`;
        const ledgerRef = db.collection("coinLedger").doc(uid).collection("entries").doc(ledgerEntryId);
        const ledgerSnap = await tx.get(ledgerRef);
        if (ledgerSnap.exists) throw new functions.HttpsError("already-exists", "DUPLICATE_LEDGER_ENTRY");

        const now = new Date();
        const periodEnd = new Date(now.getTime() + plan.durationDays * 86_400_000);
        const periodEndTs = Timestamp.fromDate(periodEnd);
        const nowTs = Timestamp.fromDate(now);
        const newCashable = cashable - plan.priceNC;

        const subId = `sub_${uid}_${ledgerEntryId}`;
        const subRef = db.collection("subscriptions").doc(subId);
        const invRef = db.collection("subscriptionInvoices").doc(`inv_${ledgerEntryId}`);

        tx.set(ledgerRef, {
          uid,
          type: "subscription_debit",
          amount: -plan.priceNC,
          balanceAfter: newCashable,
          description: `Business Listing — ${plan.label}`,
          createdAt: FieldValue.serverTimestamp(),
        });

        tx.set(subRef, {
          uid, plan: planId, status: "active", currency: "NC",
          amount: plan.priceNC,
          currentPeriodStart: nowTs, currentPeriodEnd: periodEndTs,
          cancelAtPeriodEnd: false,
          lastInvoiceId: `inv_${ledgerEntryId}`,
          source: "coins",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.set(invRef, {
          subId, uid, plan: planId,
          periodStart: nowTs, periodEnd: periodEndTs,
          amount: plan.priceNC, currency: "NC",
          paidAt: FieldValue.serverTimestamp(),
          paymentMethod: "coins",
          ledgerEntryId,
          status: "paid",
        });

        tx.update(userRef, {
          cashableBalance: newCashable,
          subscription: {
            status: "active",
            currentPeriodEnd: periodEndTs,
            plan: planId,
            trialUsed: true,
            cancelAtPeriodEnd: false,
          },
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Restore any previously paused Business listings
        await restoreBusinessListings(uid);

        return { subId, periodEnd: periodEnd.toISOString() };
      });

      return { ...subDoc, status: "active" };
    } catch (err: unknown) {
      if (err instanceof functions.HttpsError) throw err;
      logger.error("subscribeWithNCCallable error", err);
      throw new functions.HttpsError("internal", "Subscription failed. Please try again.");
    }
  }
);
```

### Client-Side Implementation

```typescript
export async function subscribeWithNC(uid: string, planId: PlanId): Promise<Subscription> {
  subscribeNCSchema.parse({ uid, planId });

  const plan = SUB_PLANS.find(p => p.id === planId);
  if (!plan) throw new Error("INVALID_PLAN");

  // Deterministic subscription ID based on user + month for idempotency
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7).replace("-", ""); // e.g., "202401"
  const subId = `sub_${uid}_${monthKey}`;
  const ledgerEntryId = `sub_debit_${uid}_${monthKey}`;

  return runTransaction(db, async tx => {
    const userRef = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);

    if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

    const userData = userSnap.data();
    const cashableBalance: number = (userData.cashableBalance as number) ?? 0;
    const price = plan.priceNC;

    if (cashableBalance < price) throw new Error("INSUFFICIENT_CASHABLE_BALANCE");

    // Double-check balance inside transaction before debit
    const balanceCheck = await tx.get(userRef);
    const finalBalance = (balanceCheck.data()?.cashableBalance as number) ?? 0;
    if (finalBalance < price) {
      throw new Error("INSUFFICIENT_CASHABLE_BALANCE");
    }

    const existingSubSnap = await tx.get(doc(db, "subscriptions", subId));

    if (existingSubSnap.exists()) {
      const existingSub = existingSubSnap.data() as Subscription;
      const end = toDate(existingSub.currentPeriodEnd);
      if (end && end > new Date()) {
        throw new Error("ACTIVE_SUB_EXISTS");
      }
    }

    const ledgerRef = doc(db, "coinLedger", uid, "entries", ledgerEntryId);
    const ledgerSnap = await tx.get(ledgerRef);

    if (ledgerSnap.exists()) throw new Error("DUPLICATE_LEDGER_ENTRY");

    const now = new Date();
    const periodEnd = addDaysDSTSafe(now, plan.durationDays);
    const periodEndTs = Timestamp.fromDate(periodEnd);
    const nowTs = Timestamp.fromDate(now);
    const newCashable = cashableBalance - price;

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
    const newCoinBal = Math.max(0, (userData.coinBalance as number ?? 0) - price);
    tx.update(userRef, {
      coinBalance: newCoinBal,
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

    return { id: subId, ...sub, ledgerEntryId };
  }).then(result => {
    captureAuditEvent({
      action: "subscription_purchased",
      adminId: "system",
      adminName: "System",
      details: `Subscription purchased: ${planId} for ${plan.priceNC} NC`,
      targetId: uid,
      metadata: {
        plan: planId,
        source: "coins",
        amount: plan.priceNC,
        currency: "NC",
        ledgerEntryId: result.ledgerEntryId,
      },
    }).catch((err: unknown) => {
      captureError(err, { operation: "audit_log_subscription_purchased", uid });
    });
    const { ledgerEntryId: _, ...subscription } = result;
    return subscription as Subscription;
  });
}
```

---

## Renewal & Expiry Lifecycle

### Subscription States

```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────┐
│  trial  │────▶│ trial_ending │────▶│  active  │────▶│ renewing │
└─────────┘     └──────────────┘     └──────────┘     └──────────┘
                                            │                │
                                            ▼                ▼
                                      ┌──────────┐     ┌──────────┐
                                      │ past_due │────▶│  grace   │
                                      └──────────┘     └──────────┘
                                            │                │
                                            ▼                ▼
                                      ┌──────────┐     ┌──────────┐
                                      │ expired  │     │ cancelled│
                                      └──────────┘     └──────────┘
```

### State Transitions

| From | To | Trigger | Action |
|------|----|---------|--------|
| `trial` | `trial_ending` | T-7 days from expiry | Send reminder notification |
| `trial_ending` | `expired` | T+0 (expiry day) | Pause business listings |
| `active` | `renewing` | T-7 days from expiry | Send renewal reminder |
| `renewing` | `past_due` | T+0 (expiry day) | Mark as past due |
| `past_due` | `grace` | T+gracePeriodDays | Final grace period |
| `grace` | `expired` | T+gracePeriodDays+1 | Pause business listings |
| Any active | `cancelled` | User cancels | Set `cancelAtPeriodEnd: true` |
| Any | `comped` | Admin grants comp | Set status to `comped` |
| Any | `paused` | Admin pauses | Pause business listings |

### Grace Period Configuration

```typescript
// In config/platformSettings
{
  subscription: {
    gracePeriodDays: 5,  // Default: 5 days
    cronEnabled: true    // Enable/disable daily sweep
  }
}
```

---

## Daily Renewal Sweep (Cloud Function)

### Schedule & Configuration

```typescript
export const dailyRenewalSweep = onSchedule(
  {
    schedule: "0 2 * * *",    // 02:00 UTC daily
    timeZone: "Asia/Kolkata",
    region: "asia-south1",
    memory: "512MiB",
  },
  async () => {
    // Check if cron is enabled in platform settings
    const settingsSnap = await db.collection("config").doc("platformSettings").get();
    const settings = settingsSnap.data() ?? {};
    const cronEnabled = settings.subscription?.cronEnabled === true
      || settings.subscriptionCronEnabled === true; // fallback key

    if (!cronEnabled) {
      logger.info("dailyRenewalSweep: cronEnabled=false, skipping.");
      return;
    }

    const now = new Date();
    const gracePeriodDays: number = settings.subscription?.business?.gracePeriodDays
      ?? settings.subscriptionGracePeriodDays
      ?? 5;

    logger.info(`dailyRenewalSweep start. gracePeriodDays=${gracePeriodDays}`);

    // Fetch all non-expired, non-cancelled subscriptions
    const activeSnap = await db
      .collection("subscriptions")
      .where("status", "in", ["trial", "trial_ending", "active", "renewing", "past_due", "grace"])
      .get();

    let reminded = 0;
    let expired = 0;

    for (const subDoc of activeSnap.docs) {
      const sub = subDoc.data();
      const uid: string = sub.uid;
      const endTs = sub.currentPeriodEnd as Timestamp | undefined;
      if (!endTs) continue;

      const endDate = endTs.toDate();
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000);
      const isTrial = sub.plan === "business_trial_v1";

      // ── Reminder notifications (T-7, T-3, T-1) ───────────────────────────
      if ([7, 3, 1].includes(daysLeft)) {
        const title = isTrial
          ? `Free trial ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`
          : `Business subscription renews in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`;
        const body = isTrial
          ? "Choose a plan to keep your listing live after the trial."
          : "Top up your wallet or renew your plan to keep your listing active.";

        await writeNotification(uid, title, body, "/profile/subscription").catch(e =>
          logger.warn("notification write failed", { uid, error: e })
        );
        reminded++;
        continue;
      }

      // ── Expiry processing (daysLeft <= 0) ─────────────────────────────────
      if (daysLeft <= 0) {
        const daysExpired = Math.abs(daysLeft); // days since expiry

        if (daysExpired <= gracePeriodDays) {
          // In grace window — mark past_due
          if (sub.status !== "past_due" && sub.status !== "grace") {
            await subDoc.ref.update({
              status: daysExpired >= gracePeriodDays - 1 ? "grace" : "past_due",
              updatedAt: FieldValue.serverTimestamp(),
            });
            await db.collection("users").doc(uid).update({
              "subscription.status": daysExpired >= gracePeriodDays - 1 ? "grace" : "past_due",
              updatedAt: FieldValue.serverTimestamp(),
            }).catch(() => {}); // user doc might not exist yet — ignore
          }
        } else {
          // Grace period over — expire and pause listings
          if (sub.status !== "expired") {
            await subDoc.ref.update({
              status: "expired",
              updatedAt: FieldValue.serverTimestamp(),
            });
            await db.collection("users").doc(uid).update({
              "subscription.status": "expired",
              updatedAt: FieldValue.serverTimestamp(),
            }).catch(() => {});

            await pauseBusinessListings(uid);

            await writeNotification(
              uid,
              "Business listing paused",
              "Your subscription expired. Renew to reactivate your listing.",
              "/profile/subscription"
            ).catch(e => logger.warn("notification write failed", { uid, error: e }));

            expired++;
          }
        }
      }
    }

    logger.info(`dailyRenewalSweep done. reminded=${reminded} expired=${expired}`);
  }
);
```

### Notification Helper

```typescript
async function writeNotification(
  uid: string,
  title: string,
  body: string,
  actionUrl: string
): Promise<void> {
  await db.collection("notifications").add({
    uid,
    kind: "wallet",
    title,
    body,
    actionUrl,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}
```

---

## Admin Controls

### Admin Actions

| Action | Description | Cloud Function |
|--------|-------------|----------------|
| **Comp** | Grant complimentary subscription | `adminSubscriptionAction` |
| **Pause** | Pause subscription and listings | `adminSubscriptionAction` |
| **Force Cancel** | Cancel subscription immediately | `adminSubscriptionAction` |

### Implementation

```typescript
export const adminSubscriptionAction = functions.onCall(
  { region: "asia-south1" },
  async (request: any) => {
    const callerUid: string = request.auth?.uid;
    if (!callerUid) throw new functions.HttpsError("unauthenticated", "Must be signed in.");

    // Verify caller is admin
    const adminSnap = await db.collection("users").doc(callerUid).get();
    if (!adminSnap.exists || adminSnap.data()?.role !== "admin") {
      throw new functions.HttpsError("permission-denied", "Admin only.");
    }

    const { action, uid, planId, reason } = request.data as {
      action?: string;
      uid?: string;
      planId?: string;
      reason?: string;
    };

    if (!uid || !action) throw new functions.HttpsError("invalid-argument", "uid and action required.");

    // ── COMP ───────────────────────────────────────────────────────────────
    if (action === "comp") {
      if (!planId || !PAID_PLANS[planId]) {
        throw new functions.HttpsError("invalid-argument", "Valid planId required for comp.");
      }
      const plan = PAID_PLANS[planId];
      const now = new Date();
      const periodEnd = new Date(now.getTime() + plan.durationDays * 86_400_000);
      const periodEndTs = Timestamp.fromDate(periodEnd);
      const subId = `sub_${uid}_comp_${Date.now()}`;

      await db.runTransaction(async tx => {
        tx.set(db.collection("subscriptions").doc(subId), {
          uid, plan: planId, status: "comped", currency: "free",
          amount: 0,
          currentPeriodStart: Timestamp.fromDate(now),
          currentPeriodEnd: periodEndTs,
          cancelAtPeriodEnd: false, source: "comp",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(db.collection("users").doc(uid), {
          subscription: {
            status: "comped",
            currentPeriodEnd: periodEndTs,
            plan: planId,
            cancelAtPeriodEnd: false,
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      await db.collection("auditLogs").add({
        action: "subscription_comp_granted",
        adminId: callerUid,
        adminName: adminSnap.data()?.displayName ?? "Admin",
        targetId: uid,
        details: reason ?? "Comp granted",
        metadata: { plan: planId, subId },
        createdAt: FieldValue.serverTimestamp(),
      });

      await writeNotification(
        uid,
        "ProNeighbor sponsored your listing 🎉",
        `You received a complimentary ${plan.label} Business listing plan.`,
        "/profile/subscription"
      );

      return { success: true };
    }

    // ── PAUSE ──────────────────────────────────────────────────────────────
    if (action === "pause") {
      const existingSnap = await db
        .collection("subscriptions")
        .where("uid", "==", uid)
        .where("status", "not-in", ["expired", "cancelled"])
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        await existingSnap.docs[0].ref.update({ status: "paused", updatedAt: FieldValue.serverTimestamp() });
      }
      await db.collection("users").doc(uid).update({
        "subscription.status": "paused",
        updatedAt: FieldValue.serverTimestamp(),
      });
      await pauseBusinessListings(uid);
      await db.collection("auditLogs").add({
        action: "subscription_paused",
        adminId: callerUid,
        adminName: adminSnap.data()?.displayName ?? "Admin",
        targetId: uid,
        details: reason ?? "Admin pause",
        createdAt: FieldValue.serverTimestamp(),
      });
      return { success: true };
    }

    // ── FORCE CANCEL ───────────────────────────────────────────────────────
    if (action === "force_cancel") {
      const existingSnap = await db
        .collection("subscriptions")
        .where("uid", "==", uid)
        .where("status", "not-in", ["expired", "cancelled"])
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        await existingSnap.docs[0].ref.update({
          status: "cancelled",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await db.collection("users").doc(uid).update({
        "subscription.status": "expired",
        updatedAt: FieldValue.serverTimestamp(),
      });
      await pauseBusinessListings(uid);
      await db.collection("auditLogs").add({
        action: "subscription_force_cancelled",
        adminId: callerUid,
        adminName: adminSnap.data()?.displayName ?? "Admin",
        targetId: uid,
        details: reason ?? "Admin force cancel",
        createdAt: FieldValue.serverTimestamp(),
      });
      return { success: true };
    }

    throw new functions.HttpsError("invalid-argument", `Unknown action: ${action}`);
  }
);
```

---

## Subscription State Computation

### Client-Side State Logic

```typescript
export function computeSubState(sub: Subscription | null): SubscriptionStatus {
  if (!sub) return "expired";

  const end = toDate(sub.currentPeriodEnd);
  const start = toDate(sub.currentPeriodStart);
  const now = new Date();

  if (!end || end < now) return "expired";

  const days = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);

  // Trial periods cannot exceed 30 days
  if (sub.plan === "business_trial_v1" || sub.source === "trial") {
    const intendedTrialDuration = 30; // days
    if (start) {
      const daysSinceStart = Math.ceil((now.getTime() - start.getTime()) / 86_400_000);
      if (daysSinceStart > intendedTrialDuration || end < now) {
        return "expired";
      }
    }
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

export function daysRemaining(sub: Subscription | null): number {
  if (!sub) return 0;
  const end = toDate(sub.currentPeriodEnd);
  if (!end) return 0;
  const msLeft = end.getTime() - Date.now();
  return Math.ceil(msLeft / 86_400_000);
}
```

---

## Revenue Model Analysis

### Revenue Streams

1. **Subscription Fees**: Primary revenue from business listing subscriptions
2. **Platform Commission**: 15% fee on all booking transactions
3. **Coin Pack Sales**: Revenue from Razorpay top-ups (Blaze plan)

### Unit Economics

**Assumptions**:
- 1000 business-category professionals
- 60% conversion rate to paid (after trial)
- Average plan: 6-month at 1799 NC
- Average booking value: 500 NC
- Average bookings per pro per month: 4

**Calculations**:
- Subscription revenue: 600 × 1799 = 1,079,400 NC per 6 months = **179,900 NC/month**
- Booking commission: 1000 pros × 4 bookings × 500 NC × 15% = **300,000 NC/month**
- Total platform revenue: **479,900 NC/month** ≈ **₹4,79,900** (~$5,750 USD)

### Conversion Funnel

```
Business Category Signup
  ↓
Trial Activation (100%)
  ↓
Trial Ending (T-7 days)
  ↓
Paid Conversion (60% target)
  ↓
Renewal (80% target)
```

**Optimization Levers**:
- Improve trial experience (feature gating, value demonstration)
- Reminder notifications at T-7, T-3, T-1
- Grace period to prevent accidental churn
- Admin comp for high-value professionals

---

## Trade-offs & Future Enhancements

### Trade-off 1: NC-Only vs Fiat Payments

**Decision**: NC-only payments for subscriptions

| Pros | Cons |
|------|------|
| Simplifies subscription flow | Users must top up wallet first |
| Drives coin purchases | Friction in conversion funnel |
| No payment gateway fees | Limited to users with NC balance |
| Consistent with platform currency | Requires Blaze plan for Cloud Functions |

**When to Reconsider**:
- If conversion rate too low (<30%)
- If users request direct fiat payments
- If Razorpay integration becomes seamless

---

### Trade-off 2: Manual Renewal vs Auto-Renewal

**Decision**: Manual renewal (no auto-renewal yet)

| Pros | Cons |
|------|------|
| User control (no surprise charges) | Higher churn risk |
| Simpler implementation | Requires user action |
| No payment method storage | Revenue unpredictability |

**Future Enhancement**:
- Auto-renewal with user opt-in
- Store payment method securely (Razorpay saved cards)
- Auto-deduct from cashableBalance on expiry

---

### Trade-off 3: Hard Gating vs Soft Gating

**Decision**: Hard gating (listings hidden when subscription expires)

| Pros | Cons |
|------|------|
| Strong incentive to renew | Harsh user experience |
| Clear revenue model | Professional frustration |
| Prevents free-riding | May drive pros to competitors |

**Alternative Considered**: Soft gating (listings visible but marked "expired") → Rejected due to weaker incentive.

---

### Future Enhancements

**Phase 1 (Next Quarter)**:
- [ ] Auto-renewal with user opt-in
- [ ] Subscription analytics dashboard (MRR, churn, LTV)
- [ ] Promo codes for discounts
- [ ] Annual plan with deeper discount

**Phase 2 (6 Months)**:
- [ ] Tiered subscriptions (Basic, Pro, Enterprise)
- [ ] Add-on features (featured listing, priority support)
- [ ] Referral rewards for subscriptions
- [ ] Corporate plans (multi-user discounts)

**Phase 3 (12 Months)**:
- [ ] Fiat payment option (Razorpay direct)
- [ ] Subscription gifting (buy for another pro)
- [ ] Revenue sharing (pros pay % of earnings instead of fixed fee)
- [ ] International expansion (multi-currency support)

---

## Monitoring & Observability

### Key Metrics

1. **Subscription KPIs**:
   - Total active subscriptions by plan
   - Trial conversion rate
   - Renewal rate
   - Churn rate
   - MRR (Monthly Recurring Revenue)
   - LTV (Lifetime Value)

2. **Revenue Metrics**:
   - Total NC debited for subscriptions
   - Average revenue per user (ARPU)
   - Revenue by plan tier
   - Comp subscriptions granted

3. **Operational Metrics**:
   - Daily renewal sweep duration
   - Notification delivery rate
   - Cloud Function error rate
   - Transaction success rate

### Alerts

- **Critical**: Cloud Function failure rate > 5%
- **Warning**: Trial conversion rate < 40%
- **Info**: Daily renewal sweep skipped (cronEnabled=false)

### Logging

All subscription events logged to `auditLogs`:
- `subscription_activated` (trial)
- `subscription_purchased` (paid)
- `subscription_cancelled`
- `subscription_resumed`
- `subscription_comp_granted`
- `subscription_paused`
- `subscription_force_cancelled`

---

## References

- **docs/architecture.md**: System architecture overview
- **docs/order-flow.md**: Booking lifecycle documentation
- **docs/USER-GUIDE.md**: End-user subscription guide
- **functions/src/subscriptions.ts**: Cloud Functions implementation
- **src/services/subscriptionService.ts**: Client-side service implementation
- **firestore.rules**: Security rules for subscriptions
- **src/constants/serviceCatalog.ts**: Business category definitions
