# Business Category Subscription — Developer-Ready Implementation Spec
<!-- Status: DEVELOP-READY | Phase: P1 (Spark) → P2 (Blaze) → P3 (Post-launch) -->
<!-- Repo: github.com/Manvendra08/NeighbhorPro | Branch: main | Generated: May 6, 2026 -->

---

## 0. Overview

Gate **Business-category** service listings behind a **monthly subscription**. Single tier (`business_monthly_v1`). Price admin-editable. Payment via cashable NC (P1) + Razorpay INR (P2). 3-phase staged release; each phase independently shippable.

| Dimension | Decision |
|---|---|
| Tier | Single: `business_monthly_v1`. Multi-tier = P3. |
| Period | 30 days, calendar-month-aligned via `currentPeriodEnd`. |
| Grace | 5 days post-expiry. Bookings blocked at day 6. |
| Cancel | Stop renewal; listings live until period end. No proration. |
| Refund | Admin-only (NC: `admin_credit`; INR: manual Razorpay + admin records ref). |
| Trust signal | `<ActiveProPill>` on BrowsePros + ProDetail (P2). |
| Deploy posture | Spark now → Blaze before launch. `onSchedule` cron + Razorpay webhook on Blaze. |

---

## 1. Phased Rollout

| | Phase 1 — MVP (Spark) | Phase 2 — Polish (Blaze) | Phase 3 — Post-launch |
|---|---|---|---|
| **Payment** | NC cashable bucket only | + Razorpay INR rail + webhook | True Razorpay mandates/auto-debit |
| **Renewal** | Manual "Renew now" button; lazy expiry client-side | `onSchedule` cron; auto-debit NC; reminders T-3/T-1/T+0 | Auto-debit Razorpay mandate |
| **Listing degrade** | Client-side filter of `paused_subscription` | Atomic batch flip via CF `degradeListings` | Same |
| **New files** | `subscriptionService.ts`, `SubscriptionManage.tsx`, `SubscribeSheet.tsx`, `SubscriptionBanner.tsx`, backfill script | + `subscriptions.ts` CF, `AdminSubscriptions.tsx`, `ActiveProPill.tsx` | Promo codes, churn dashboard, CSV export |
| **Admin** | Extend `AdminUsers` (sub column + grant/revoke) + `AdminSettings` (sub tab) | New `AdminSubscriptions.tsx` full KPI page | Annual plan, multi-tier, promo codes |
| **Notifications** | Manual UI banner only | `wallet`-kind renewal/expiry/comp push | + Email/SMS, PDF invoices |
| **Cashable bucket** | Lazy `getCashableBalance(uid)` + one-time backfill script | Denormalized `cashableBalance`/`promoBalance` on user doc; tighten `coinPayouts` to cashable-only | Same |
| **Tests** | Unit on `subscriptionService` + cashable; rules snapshot | + MSW integration; Playwright E2E | Load/cron tests |

---

## 2. Cashable-NC Bucket

> **New capability. No Firestore schema migration required.**

### 2.1 Add to `src/services/coinService.ts`

```ts
export const CASHABLE_LEDGER_TYPES: LedgerType[] = [
  'topup',
  'booking_escrow_release',
  'booking_refund',
];

export const PROMO_LEDGER_TYPES: LedgerType[] = [
  'earn_signup_bonus', 'earn_profile', 'earn_referral', 'earn_review',
  'earn_free_consult', 'earn_milestone', 'earn_groupsession', 'earn_ondemand',
  'admin_credit',
];

export const SUBSCRIPTION_LEDGER_TYPE = 'subscription_debit'; // new
```

### 2.2 New function: `getCashableBalance(uid)`

```ts
export async function getCashableBalance(uid: string): Promise<number> {
  const entries = await getDocs(collection(db, 'coinLedger', uid, 'entries'));
  let cashable = 0;
  entries.forEach(doc => {
    const d = doc.data();
    if (CASHABLE_LEDGER_TYPES.includes(d.type)) cashable += d.amount;
    if (d.type === 'subscription_debit') cashable += d.amount; // negative
  });
  return Math.max(0, cashable);
}
```

### 2.3 Denormalized fields on user doc (P2)
users/{uid}:
cashableBalance: number // updated atomically in every ledger runTransaction
promoBalance: number

text
`coinBalance` (existing total) unchanged. All three updated in same `runTransaction`.

### 2.4 Tighten `coinPayouts` to cashable-only (P2)

In `requestPayout`: replace `coinBalance >= coinsToRedeem` guard with `cashableBalance >= coinsToRedeem`. **Audit all pending payouts in staging before deploying.**

---

## 3. Data Model

### 3.1 `config/platformSettings.subscription`

```ts
subscription: {
  enabled: boolean,
  business: {
    monthlyPriceINR: number,
    monthlyPriceNC: number,
    gracePeriodDays: number,        // 5
    renewalReminderDays: number[],  //[1][2]
    autoDebitNCEnabled: boolean,
    founderPromoActive: boolean,
    founderPromoCap: number,
    cronEnabled: boolean,           // flip true when P2 CF deployed
  }
}
```

### 3.2 `subscriptions/{subId}`

`subId` = `sub_${uid}_${YYYYMM}` — deterministic, idempotent.

```ts
interface Subscription {
  uid: string;
  plan: 'business_monthly_v1';
  status: 'active'|'renewing'|'past_due'|'grace'|'expired'|'cancelled'|'comped'|'paused';
  currency: 'INR'|'NC';
  amount: number;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  autoRenewCoins: boolean;
  cancelAtPeriodEnd: boolean;
  lastInvoiceId: string;
  source: 'razorpay'|'coins'|'comp'|'admin_grant';
  promoCode?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3.3 `subscriptionInvoices/{invoiceId}`

`invoiceId` = `inv_${razorpayPaymentId}` OR `inv_${ledgerEntryId}` — idempotent.

```ts
interface SubscriptionInvoice {
  subId: string; uid: string;
  periodStart: Timestamp; periodEnd: Timestamp;
  amount: number; currency: 'INR'|'NC';
  paidAt: Timestamp;
  paymentMethod: 'razorpay'|'coins'|'comp';
  razorpayPaymentId?: string;
  ledgerEntryId?: string;
  status: 'paid'|'refunded'|'disputed';
}
```

### 3.4 Denormalized fields

```ts
// users/{uid}
subscription: { status, currentPeriodEnd, plan, autoRenewCoins }
cashableBalance: number  // P2
promoBalance: number     // P2

// services/{id}
subStatus: 'active'|'paused_subscription'|null  // null = non-Business
```

### 3.5 New service status: `paused_subscription`

- `bookable = false`, hidden from BrowsePros
- ProDetail copy: "Currently unavailable — coming back soon."
- No payment context exposed to residents

---

## 4. Lifecycle States → UI

| State | Visible | Bookable | Banner | Pill | CTA |
|---|---|---|---|---|---|
| `none` | no | no | "Activate listing — ₹X/mo" | — | Subscribe |
| `active` | yes | yes | "Active" pill | Active Pro | — |
| `renewing` T-3..T-1 | yes | yes | amber "Renew by [date]" | Active Pro | Renew |
| `past_due` T+0..T+5 | dim | yes | amber "Confirm payment" | dim | Renew now |
| `grace` T+5..T+6 | faded | **NO** | red "Pauses tomorrow" | faded | Renew today |
| `expired` | **NO** | **NO** | "Listing paused — renew" | hidden | Reactivate |
| `cancelled` | yes till end | yes | "Cancellation set [date]" | Active Pro | Resume |
| `comped` | yes | yes | "Founder slot — sponsored" | Active Pro | — |
| `paused` (admin) | **NO** | **NO** | "Paused — see admin notice" | hidden | — |

**Lazy expiry (P1):** `isExpired = currentPeriodEnd.toMillis() < Date.now()` — computed client-side, no cron needed.

---

## 5. New Files

### 5.1 `src/services/subscriptionService.ts` (P1)

```ts
export async function getSubscription(uid: string): Promise<Subscription | null>
export async function subscribeWithNC(uid: string, plan: string, autoRenew: boolean): Promise<void>
export async function cancelSubscription(uid: string, subId: string): Promise<void>
export async function resumeSubscription(uid: string, subId: string): Promise<void>
export async function getSubscriptionInvoices(uid: string, limit?: number): Promise<SubscriptionInvoice[]>
// P2:
export async function subscribeWithRazorpay(uid: string, plan: string): Promise<void>
```

**`subscribeWithNC` — atomic `runTransaction`:**
1. Validate `cashableBalance >= price` (inside tx)
2. Check `sub_${uid}_${YYYYMM}` — throw `ALREADY_SUBSCRIBED` if active
3. Append ledger entry: `type: 'subscription_debit'`, negative amount, deterministic `dedupKey`
4. Write `subscriptions/{subId}`: `status: 'active'`, `currentPeriodEnd = now + 30d`
5. Write `subscriptionInvoices/inv_${ledgerEntryId}`
6. Update `users/{uid}.subscription` denorm

Zod validation at boundary before any write.

### 5.2 `src/services/subscriptionService.test.ts` (P1)
✓ subscribeWithNC — idempotent on same YYYYMM key
✓ subscribeWithNC — throws INSUFFICIENT_CASHABLE_BALANCE (promo-only balance)
✓ cancelSubscription — sets cancelAtPeriodEnd:true, does NOT expire immediately
✓ Expiry math — currentPeriodEnd exactly 30d from currentPeriodStart
✓ getCashableBalance — correct on mixed cashable + promo ledger

text

### 5.3 `src/pages/SubscriptionManage.tsx` (P1, route: `/profile/subscription`)

- Status card (state, next charge, payment method)
- Invoice list (paginated, last 12)
- Actions: Cancel / Resume / Toggle auto-debit NC
- If `cashableBalance < price`: "Top up coins to enable NC renewal" + top-up deeplink

### 5.4 `src/components/SubscribeSheet.tsx` (P1)

- 4 value props
- Payment toggle: NC (P1) / Razorpay ₹X (P2, disabled at P1)
- NC disabled with tooltip: "Subscriptions need cashable NC. Top up or use Razorpay." if balance insufficient
- Founder promo input (if `founderPromoActive`)
- Auto-debit checkbox (NC path only)

### 5.5 `src/components/SubscriptionBanner.tsx` (P1)

Props: `status`, `currentPeriodEnd`, `onRenew`. Renders correct copy + color per §4 table. Used: `Profile.tsx` (P1), `Wallet.tsx` (P1), `ProDetail.tsx` (P2).

### 5.6 `src/components/ActiveProPill.tsx` (P2)

Show on BrowsePros + ProDetail when `subscription.status in ['active','renewing','cancelled','comped']`.
Copy: *"Verified neighbour committed to keeping a live listing."*

### 5.7 `src/pages/admin/AdminSubscriptions.tsx` (P2, route: `/admin/subscriptions`)

**KPI strip:** Total MRR | Churn % | Comped count | Past-due count | Founder-slot usage

**Table:** Pro | Society | State | Plan | Period | Payment | Next charge | MRR

**Row actions:**

| Action | Write |
|---|---|
| Comp (1/3/6/12 mo, reason required) | `subscriptions` `source='comp'` + extend `currentPeriodEnd` + `auditLog` |
| Pause (reason required) | `status='paused'` + `auditLog` + `activityLog` |
| Force-cancel (optional refund) | `status='expired'`; NC: `admin_credit` to cashable; INR: manual ref + `auditLog` |
| Refund last invoice | Mark `subscriptionInvoices/{id}.status='refunded'` |
| View ledger | Deep-link `/admin/wallet?uid={uid}` |

### 5.8 `functions/src/subscriptions.ts` (P2)

```ts
// Callable — auth-guarded
export const subscribeWithNC = onCall(...)
export const adminSubscriptionAction = onCall(...)  // admin-only

// Scheduled 02:00 IST daily — Blaze only
export const dailyRenewalSweep = onSchedule('0 20 * * *', async () => {
  // check cronEnabled flag first
  // T-3, T-1 → reminder notification
  // T+0 + autoRenewCoins + cashableBalance >= price → atomic debit + extend period
  // T+0 + no auto → past_due + notification
  // T-5 → expired + degradeListings(uid)
})

export const degradeListings = async (uid: string) => {
  const snap = await getDocs(query(servicesRef, where('userId', '==', uid)));
  const batch = writeBatch(db);
  snap.docs.forEach(doc => {
    if (isBusinessCategory(doc.data().category))
      batch.update(doc.ref, { subStatus: 'paused_subscription' });
  });
  await batch.commit();
}

export const reconcileSubscriptions = onSchedule('0 3 * * *', ...) // nightly backstop
```

### 5.9 `scripts/backfillBalanceBuckets.cjs` (P1, one-time)

- For each uid: compute `cashableBalance` + `promoBalance` from full ledger history
- Write atomically to `users/{uid}`
- Log diff vs `coinBalance`; flag mismatches
- **Run in staging first; spot-check 10 users before prod**

---

## 6. Files to Modify

### 6.1 `src/constants/serviceCatalog.ts` (P1)

```ts
export const BUSINESS_CATEGORIES: string[] = [
  // full list from CATEGORY_GROUPS.Business — must match firestore.rules literal exactly
];
export function isBusinessCategory(category: string): boolean {
  return BUSINESS_CATEGORIES.includes(category);
}
```

> **Snapshot test mandatory** — `BUSINESS_CATEGORIES` ↔ `firestore.rules` literal list parity.

### 6.2 `src/services/coinService.ts` (P1 + P2)

P1: Add `'subscription_debit'` to `LedgerType`, export bucket arrays, add `getCashableBalance`.
P2: Update all `runTransaction` ledger writes to atomically update `cashableBalance`/`promoBalance`; tighten `requestPayout` guard.

### 6.3 `src/services/auditService.ts` (P1)

Extend `AUDIT_SCHEMA`:
subscription_purchased | subscription_cancelled | subscription_paused
subscription_resumed | subscription_refunded | subscription_comp_granted
subscription_force_cancelled

text
Required fields: `['action','adminId','adminName','details','targetId']`
Metadata: `['plan','periodEnd','source','amount','currency']`

### 6.4 `src/services/activityService.ts` (P1)

```ts
type ActivityEvent = ... 
  | 'subscription.purchased' | 'subscription.renewed' | 'subscription.cancelled'
  | 'subscription.expired' | 'subscription.paused' | 'subscription.comp_granted'
```

### 6.5 `src/services/firestoreService.ts` (P1)

`createService` — add guard before `addDoc`:
```ts
if (isBusinessCategory(data.category)) {
  const userDoc = await getUserProfile(data.userId);
  const sub = userDoc?.subscription;
  const isActive = ['active','renewing','past_due','grace','comped'].includes(sub?.status ?? '');
  if (!isActive) throw new Error('SUBSCRIPTION_REQUIRED');
}
```

`getServicesByUser`: non-owner callers → add `where('subStatus', '!=', 'paused_subscription')`.
`listProfessionals`: add same filter for Business category results.

### 6.6 `src/pages/Profile.tsx` (P1)

- Business category selected + no active sub → CTA becomes "Activate listing" → opens `<SubscribeSheet>`
- Each Business listing row → `<SubscriptionBanner status=... />`
- Add "Manage subscription →" nav to `/profile/subscription`

### 6.7 `src/pages/Wallet.tsx` (P1)

- Add "Subscriptions" section above ledger
- `subscription_debit` entries: subscription icon + "Business listing — [period]" label

### 6.8 `src/pages/admin/AdminUsers.tsx` (P1)

- Add "Subscription" column: `{status} ({daysRemaining}d)` or "None"
- Row actions: Grant sub (`source='admin_grant'`) | Revoke sub (`status='paused'`)
- Both write `auditLog`

### 6.9 `src/pages/admin/AdminSettings.tsx` (P1)

New "Subscription" tab — edit: `monthlyPriceINR`, `monthlyPriceNC`, `gracePeriodDays`, `founderPromoActive`/Cap, `autoDebitNCEnabled`, `cronEnabled`.

### 6.10 `src/pages/admin/AdminServices.tsx` (P2)

- "Sub" column: colored dot (green=active, red=paused_subscription, grey=null)
- Block Approve/Feature for Business listings if pro lacks active sub (tooltip)

### 6.11 `src/pages/BrowsePros.tsx` (P2)

- `<ActiveProPill />` on subscribed Business pro cards
- Server-side filter: `where('subStatus', '!=', 'paused_subscription')`

### 6.12 `src/pages/ProDetail.tsx` (P2)

- `<ActiveProPill />` near pro name
- Book CTA disabled if `subStatus === 'paused_subscription'`

### 6.13 `src/App.tsx`

```tsx
// P1
<Route path="/profile/subscription" element={<SubscriptionManage />} />
// P2
<Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
```

### 6.14 `functions/src/index.ts` (P2)

- Extend `razorpayWebhook`: branch on `purpose === 'subscription'` → write sub + invoice docs (idempotent on `razorpayPaymentId`)
- Export all fns from `functions/src/subscriptions.ts`

### 6.15 `src/components/layout/NotificationCenter.tsx` (P2)

Render subtypes: `sub_renewal_reminder`, `sub_past_due`, `sub_expired`, `sub_comp_granted`, `sub_admin_action`.

---

## 7. Security Rules — `firestore.rules`
match /subscriptions/{subId} {
allow read: if isSignedIn() && (resource.data.uid == request.auth.uid || isAdmin());
allow create: if isAdmin();
allow update: if isAdmin();
allow delete: if false;
}
match /subscriptionInvoices/{invId} {
allow read: if isSignedIn() && (resource.data.uid == request.auth.uid || isAdmin());
allow create: if isAdmin();
allow update, delete: if false;
}

text

`services` create rule extension:
allow create: if isSignedIn()
&& request.resource.data.userId == request.auth.uid
&& (
!(request.resource.data.category in BUSINESS_CATEGORIES_LITERAL)
|| get(/databases/$(database)/documents/users/$(request.auth.uid))
.data.subscription.status in ['active','renewing','past_due','grace','comped']
);

text

`coinLedger validLedgerEntry()`: add `'subscription_debit'` to allowed types for owner.

---

## 8. End-to-End Flows

### 8.1 First-time subscribe (P1)

1. Pro selects Business category → CTA morphs to "Activate listing"
2. `<SubscribeSheet>` opens → pro selects NC path
3. `subscribeWithNC()` callable: cashable guard + atomic tx (ledger + sub + invoice + denorm)
4. Success → `createService()` proceeds (`status: 'pending'`)

### 8.2 Renewal (P2 cron)

`dailyRenewalSweep` 02:00 IST:
- T-3, T-1 → reminder push
- T+0 + auto-debit + cashable balance OK → debit + extend `currentPeriodEnd` +30d
- T+0 + no auto → `past_due` + push
- T-5 → `expired` + `degradeListings(uid)`

### 8.3 Idempotency Guards

| Operation | Guard |
|---|---|
| `subscribeWithNC` | `sub_${uid}_${YYYYMM}` existence in `runTransaction` |
| Invoice write | `inv_${ledgerEntryId}` or `inv_${razorpayPaymentId}` |
| `degradeListings` | `subStatus === 'paused_subscription'` check before batch |
| Razorpay webhook | `subscriptionInvoices/{razorpayPaymentId}` existence check |

---

## 9. Tests

### 9.1 P1 Unit (Vitest)
subscriptionService.test.ts:
✓ subscribeWithNC idempotent on same YYYYMM
✓ subscribeWithNC throws INSUFFICIENT_CASHABLE_BALANCE on promo-only NC
✓ cancelSubscription sets cancelAtPeriodEnd:true, does not expire
✓ Expiry math: currentPeriodEnd = currentPeriodStart + 30d exactly
✓ getCashableBalance correct on mixed ledger

coinService.test.ts (extensions):
✓ subscription_debit writes against cashable bucket only
✓ getCashableBalance correct split

serviceCatalog.test.ts (snapshot):
✓ BUSINESS_CATEGORIES matches firestore.rules literal list
✓ isBusinessCategory returns true for all Business categories

text

### 9.2 P2 Integration (MSW)
✓ subscribeWithNC happy path: ledger + sub + invoice + denorm all written
✓ Business createService blocked when sub not active
✓ Admin grant: auditLog + activityLog written
✓ Razorpay webhook idempotent on duplicate razorpayPaymentId
✓ dailyRenewalSweep reminder cadence (T-3, T-1, T+0)
✓ degradeListings flips all Business listings atomically

text

### 9.3 P2 E2E (Playwright — `e2e/subscription.spec.ts`)
Pro creates Business listing → blocked → subscribes → listing submits ✓

Pro renews via NC → period extended → ledger visible in Wallet ✓

Sub expires → listing disappears from BrowsePros → reactivate → reappears ✓

Admin comp → status flips → AuditLog shows event ✓

cashable-balance.spec.ts: promo-only NC → NC toggle disabled with tooltip ✓

text

---

## 10. Notifications

| Trigger | Kind | Copy |
|---|---|---|
| T-3 reminder | `wallet` | "Your Business listing renews in 3 days. Renew now →" |
| T-1 reminder | `wallet` | "Last chance — listing renews tomorrow." |
| `past_due` | `wallet` | "Confirm payment to keep your listing live →" |
| `expired` | `wallet` | "Your Business listing is paused. Reactivate →" |
| Comp granted | `wallet` | "You got {N} free months from ProNeighbor 🎉" |
| Force-cancel | `admin_action` | "Your subscription was cancelled: {reason}" |

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Rules drift: `firestore.rules` Business list ≠ `serviceCatalog.ts` | Vitest snapshot test — mandatory P1 |
| Legacy users: wrong `cashableBalance` | Backfill script in staging; spot-check 10 users; diff vs `coinBalance` |
| `coinPayouts` draining promo NC (policy stated, not enforced) | Audit pending payouts before P2 tighten; `admin_credit`-refund any promo drainings |
| P1→P2 double-debit (lazy + cron) | `cronEnabled` flag; cron checks flag before running |
| Concurrent sub attempts same uid+month | Deterministic `sub_${uid}_${YYYYMM}` + `runTransaction` |
| Webhook lost | Idempotent invoice ID + nightly `reconcileSubscriptions` CF |
| Active bookings on lapse | Honored end-to-end; only new booking creation blocked |

---

## 12. Open Decisions (Set in AdminSettings post-P1)

- Monthly INR price (₹99 / ₹199 / ₹299 / ₹499)
- Monthly NC price (300 / 500 / 750 NC)
- Founder promo cap and duration
- Auto-debit NC: default ON or OFF

---

## 13. Deferred to Phase 3

- True Razorpay mandates
- Multi-tier plans
- Promo code system
- Annual plan (12 months, 2 months free)
- A/B price test
- Society-sponsored listings
- Email/SMS receipts + PDF invoices
- Churn dashboard + CSV export
- Load test cron at 10k subscriptions

---
<!-- END OF SPEC -->