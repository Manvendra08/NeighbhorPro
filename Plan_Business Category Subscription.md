# Plan — Business Category Subscription

## Context

Today: pros list services free under 3 groups (Business / Services / E-Commerce). No paywall, no recurring revenue, no commitment signal to residents. Listings drift to stale or low-quality.

Goal: gate **Business-category listings** behind a **monthly subscription**. Pros pay to keep Business listings live. Residents see a "committed pro" trust signal. Admin tools for grant/refund/audit. Big-bang launch (single coherent release), Spark-now/Blaze-before-launch deploy posture.

Scope confirmed w/ user:
- **Payment rails**: INR (Razorpay) + cashable NC (only NC sourced from `topup` / `booking_escrow_release` / `booking_refund` — NOT promo/admin-granted)
- **Plan**: Spark now → Blaze before launch. Razorpay-recurring pieces & `onSchedule` cron deploy on Blaze switch. Coins path + lazy expiry work on Spark.
- **Pricing**: admin-editable via `config/platformSettings.subscription.*`. No hardcoded number.
- **Rollout**: **3-phase staged release** (P1 lean MVP on Spark → P2 polish on Blaze → P3 advanced post-launch).

---

## Phased Rollout (overview — detail per section below)

| | Phase 1 — MVP (Spark) | Phase 2 — Polish (Blaze pre-launch) | Phase 3 — Advanced (post-launch) |
|---|---|---|---|
| **Goal** | Working gate, working pay flow, validated economics | Production-ready trust signal + automation | Scale & optimize |
| **Payment** | NC (cashable bucket only) | + Razorpay INR rail, webhook | True Razorpay subscriptions/mandates |
| **Renewal** | Manual ("Renew now" button); lazy expiry computed client-side | Cloud `onSchedule` cron sweep; auto-debit NC; reminders T-3/T-1/T+0 | Auto-debit Razorpay via mandate |
| **Listing degrade** | Lazy: Browse filters out expired Business listings client-side | Atomic batch flip via Cloud Function | Same |
| **Surfaces** | Profile gate + `SubscriptionBanner` + `/profile/subscription` manage page + Wallet card | + Active Pro pill (BrowsePros, ProDetail) + AdminSubscriptions full + AdminSettings tab + AdminServices Sub column | + Promo codes UI, churn dashboard, CSV export |
| **Admin** | Extend AdminUsers w/ Subscription column + grant/revoke action | New `AdminSubscriptions.tsx` page (full KPIs + actions) | + Annual plan toggle, multi-tier mgmt |
| **Notifications** | None (manual UI banner only) | `wallet`-kind renewal/expiry/comp notifications | + Email/SMS, PDF invoices |
| **Cashable bucket** | Computed lazy `getCashableBalance(uid)`; one-time backfill script | Denormalized `users.cashableBalance` / `promoBalance` updated atomically in ledger writes; tighten `coinPayouts` to cashable-only | Same |
| **Pricing** | Admin-editable in `config/platformSettings.subscription`; Founder promo manual flag | + Founder promo enforcement w/ cap counter | + Promo code system, A/B price |
| **Tests** | Unit on `subscriptionService` + cashable bucket; rules snapshot test | + MSW integration; Playwright E2E happy paths | + Load/cron tests |

Each phase is independently shippable. Phase 1 deliverable on Spark today.

---

## Decisions

| | |
|---|---|
| Tier | Single tier (`business_monthly_v1`). Multi-tier deferred. Price admin-editable. |
| Period | 30 days (calendar-month-aligned by `currentPeriodEnd`). |
| Auto-renew | Coins: opt-in auto-debit if cashable balance ≥ price. Razorpay: manual reauth (one-tap "Renew" deeplink 3d before expiry). True Razorpay mandates = Phase-3. |
| Grace | 5 days post-expiry. Listings dim, new bookings blocked at d6. |
| Cancel | Stop renewal, listings live until period end. No proration. |
| Refund | Admin-only via `AdminSubscriptions` (writes `admin_credit` for NC, manual Razorpay refund). |
| Trust signal | "Active Pro" pill on `BrowsePros` + `ProDetail`. Honest copy: *"Verified neighbour committed to keeping a live listing."* |

---

## Cashable-NC bucket (NEW capability)

Today the ledger doesn't distinguish purchased vs promo NC. User wants subscription paid only with cashable NC (real-money source).

**Definition** (computed, no schema migration):
```ts
// src/services/coinService.ts — add
export const CASHABLE_LEDGER_TYPES: LedgerType[] = [
  'topup', 'booking_escrow_release', 'booking_refund'
];
export const PROMO_LEDGER_TYPES: LedgerType[] = [
  'earn_signup_bonus','earn_profile','earn_referral','earn_review',
  'earn_free_consult','earn_milestone','earn_groupsession','earn_ondemand',
  'admin_credit'
];
```

**Cashable balance** computed by summing signed amounts of cashable-source entries minus their consumed portion. Implementation: maintain two denormalized fields on user doc: `cashableBalance`, `promoBalance`. Existing `coinBalance` stays as total. Update inside the same `runTransaction` that writes ledger entries.

**Spend priority** (existing behaviors): bookings & payouts can spend either bucket (payout already INR cash-out — keep cashable-only). **Subscription debit ONLY pulls cashable.**

This unlocks correctness for the existing `coinPayouts` flow too (already-stated policy in `NC_TERMS_DEFAULTS.refundPolicy`: *"Earned NC is non-refundable"* — never enforced; this enforces it).

---

## Data model

### `config/platformSettings.subscription` (admin-editable)
```
{
  enabled: bool,
  business: {
    monthlyPriceINR: number,        // e.g. 299
    monthlyPriceNC: number,         // e.g. 500
    gracePeriodDays: number,        // 5
    renewalReminderDays: number[],  // [3,1,0]
    autoDebitNCEnabled: bool,
    founderPromoActive: bool,
    founderPromoCap: number         // first N pros free first month
  }
}
```

### `subscriptions/{subId}`  (subId = `sub_${uid}_${monthKey}` — deterministic, idempotent)
```
uid, plan: 'business_monthly_v1',
status: 'active'|'renewing'|'past_due'|'grace'|'expired'|'cancelled'|'comped'|'paused',
currency: 'INR'|'NC', amount,
currentPeriodStart, currentPeriodEnd,
autoRenewCoins: bool, cancelAtPeriodEnd: bool,
lastInvoiceId, source: 'razorpay'|'coins'|'comp'|'admin_grant',
promoCode?, createdAt, updatedAt
```

### `subscriptionInvoices/{invoiceId}`  (idempotent ID = `inv_${razorpayPaymentId}` or `inv_${ledgerEntryId}`)
```
subId, uid, periodStart, periodEnd, amount, currency,
paidAt, paymentMethod: 'razorpay'|'coins'|'comp',
razorpayPaymentId?, ledgerEntryId?, status
```

### Denormalized for fast reads
- `users/{uid}.subscription = { status, currentPeriodEnd, plan, autoRenewCoins }`
- `users/{uid}.cashableBalance`, `users/{uid}.promoBalance`
- `services/{id}.subStatus = 'active'|'paused_subscription'|null`  (null for non-Business)

### New ledger type
`subscription_debit` (only writes against cashable bucket).

### New service status
`paused_subscription` — distinct from admin `rejected`. Bookable=false, hidden in BrowsePros, public ProDetail shows "Currently unavailable."

---

## Lifecycle states → UI affordances

| State | Listing visible | Bookable | Profile banner | BrowsePros pill | Renewal CTA |
|---|---|---|---|---|---|
| none | no | no | "Activate listing — ₹X/mo" | n/a | Subscribe |
| active | yes | yes | small "Active" pill | Active Pro | none |
| renewing (T-3..T-1) | yes | yes | amber "Renew by [date]" | Active Pro | Renew |
| past_due (T+0..T+5) | yes (dim) | yes | amber "Confirm payment" | Active Pro (dim) | Renew now |
| grace (T+5..T+6) | yes (faded) | NO | red "Pauses tomorrow" | Active Pro (faded) | Renew today |
| expired | NO | NO | "Listing paused — renew" | hidden | Reactivate |
| cancelled | yes till period end | yes | "Cancellation set [date]" | Active Pro | Resume |
| comped | yes | yes | "Founder slot — sponsored" | Active Pro | n/a |
| paused (admin) | NO | NO | "Paused — see admin notice" | hidden | n/a |

---

## End-to-end flows

### 1. First-time subscribe (entry point: Profile service form)
- User selects category. If `getCategoryGroup(category) === 'Business'` AND no active sub → submit CTA morphs to **"Activate listing"**.
- Tap → `<SubscribeSheet>` (bottom sheet mobile / modal desktop). Cards:
  - Value props (4 bullets — "live listing across society / Active Pro pill / commitment to respond / dispute support")
  - Payment toggle: Razorpay (₹X) / Cashable NC (Y NC, only enabled if cashable balance ≥ Y)
  - Founder promo input (admin-toggleable)
  - "Auto-debit from coins next month" checkbox (NC path only)
- Razorpay: existing `createRazorpayOrder` call — extend payload `{ purpose: 'subscription', plan: 'business_monthly_v1' }`. Webhook (`razorpayWebhook`) branches on `purpose`, writes `subscriptionInvoices` + `subscriptions` doc + denorm `users.subscription`. Atomic, idempotent on `razorpayPaymentId`.
- NC: client `runTransaction` — guard cashable balance, write `subscription_debit` ledger entry with deterministic ID, write `subscriptions` + `subscriptionInvoices`, update denorm.
- After payment → service `createService` proceeds with `pending` status (existing flow).

### 2. Manage (`/profile/subscription` — new route)
`SubscriptionManage.tsx`. One liquid-glass card: state + next charge + payment method + invoice list (paginated, last 12) + cancel/resume + auto-debit toggle.

### 3. Renewal (Phase deploy on Blaze switch)
**Cloud scheduler** `dailyRenewalSweep` (`functions/src/index.ts`) runs 02:00 IST:
- query `subscriptions` where `currentPeriodEnd in {T+3, T+1, T+0, T-5}`
- T+3, T+1: send `wallet`-kind notification "Renew before [date]"
- T+0: if `autoRenewCoins && cashableBalance >= price` → atomic debit + extend `currentPeriodEnd`. Else → `past_due`.
- T-5: flip `expired`, batch-mark services `paused_subscription` (single tx per pro).
- T-7 (sweep stale): just-in-case backstop for missed renewals.

Lazy expiry fallback for Spark window: every read of `users.subscription` in client computes "stale?" by comparing `currentPeriodEnd` to now; banner shows correct state even if cron not yet running.

### 4. Failure recovery
NC auto-debit fails → `past_due` + notification with two CTAs: "Top up coins" / "Pay ₹X via Razorpay". Both deeplink to `/profile/subscription`.

### 5. Lapse → listing degradation
Atomic Cloud Function `degradeListings(uid)`:
- batch update `services` where `userId == uid && getCategoryGroup(category) === 'Business'` → `subStatus = 'paused_subscription'`.
- Existing approved listings disappear from BrowsePros (filter out `subStatus === 'paused_subscription'`).
- ProDetail: public copy *"Currently unavailable — coming back soon."* No payment context exposed.
- **Existing bookings honored end-to-end.** Only new bookings blocked.

### 6. Category switch
Pro moves listing Business → Services/E-Commerce: `subStatus = null`, free-tier rules apply. Subscription continues until period end then naturally expires if no Business listings remain.

---

## Per-page UX touchpoints

| Page | Change |
|---|---|
| `src/pages/Profile.tsx` | Service form gate, sub status pill on each Business listing row, route to `/profile/subscription` |
| `src/pages/SubscriptionManage.tsx` (NEW) | full management surface |
| `src/pages/Wallet.tsx` | "Subscriptions" section above ledger; subscription debits inline in ledger w/ icon |
| `src/pages/BrowsePros.tsx` | Active Pro pill on subscribed Business pros; filter out `subStatus === 'paused_subscription'` |
| `src/pages/ProDetail.tsx` | Active Pro pill near pro name; book CTA disabled when pro's Business listing is paused |
| `src/pages/admin/AdminSubscriptions.tsx` (NEW) | full admin tooling |
| `src/pages/admin/AdminServices.tsx` | "Sub" column dot; block approve/feature on Business listing if pro lacks active sub |
| `src/pages/admin/AdminUsers.tsx` | Subscription column (days remaining); link to `AdminSubscriptions` filtered to that user |
| `src/pages/admin/AdminSettings.tsx` | new "Subscription" tab → edit `config/platformSettings.subscription.*` |
| `src/components/layout/NotificationCenter.tsx` | render new sub-related notifications via existing `wallet` kind |
| `src/pages/LandingPage.tsx` | optional copy line under categories: "Business listings include monthly subscription. Learn more." |

---

## Admin tooling — `AdminSubscriptions.tsx`

Table columns: pro, society, state, plan, current period, payment method, next charge, MRR contribution.

Top KPI strip: total MRR, churn %, comped count, past-due count, founder-slot usage.

Row actions:
- **Comp** — grant N free months (1/3/6/12), reason required → writes `subscriptions` doc with `source='comp'` + `auditLog` event
- **Pause** — admin freeze with reason; listings hidden + Active Pro pill removed
- **Force-cancel** — immediate end, optional refund (NC: `admin_credit` to cashable bucket; INR: manual Razorpay refund — admin records reference)
- **Refund last invoice** — same as above
- **View ledger** — opens AdminWallet filtered to this uid

Every action → `auditLog` w/ before/after JSON. Every action → `activityLog` user-facing event.

---

## Security rules (`firestore.rules`)

```
match /subscriptions/{subId} {
  allow read: if isSignedIn() && (resource.data.uid == request.auth.uid || isAdmin());
  allow create: if isAdmin();              // server-only: created by Razorpay webhook OR validated client tx
  allow update: if isAdmin();
  allow delete: if false;
}
match /subscriptionInvoices/{invId} {
  allow read: if isSignedIn() && (resource.data.uid == request.auth.uid || isAdmin());
  allow create: if isAdmin();
  allow update, delete: if false;          // append-only
}
```

Client NC-debit path: validated inside Cloud Function `subscribeWithNC` (callable). Same idempotency pattern as `createRazorpayOrder`. Avoids letting client write `subscriptions` directly.

`services` create rule extension — block Business creates if pro lacks active sub:
```
allow create: if isSignedIn()
  && request.resource.data.userId == request.auth.uid
  && (
    !(request.resource.data.category in [<5 Business strings duplicated here>])
    || (
      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.subscription.status in ['active','renewing','past_due','grace','comped']
      && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.subscription.currentPeriodEnd > request.time
    )
  );
```
Drift risk between rules-literal Business list and `serviceCatalog.ts` → add Vitest snapshot test asserting the two match.

`coinLedger` rule — extend `validLedgerEntry()` to allow `subscription_debit` type for owner.

---

## Notifications

Reuse existing `wallet` kind (matches user mental model — money moving). Triggers:
- T-3 / T-1 / T+0 renewal reminders (Cloud scheduler)
- past_due → "Confirm payment to keep your listing live"
- expired → "Your Business listing is paused"
- comp granted → "You got N free months from ProNeighbor 🎉"
- admin force-cancel → `admin_action` kind w/ reason

Implementation: extend `notifications` collection writer in cron + webhook handlers. UI already supports `wallet` kind in `NotificationCenter.tsx`.

---

## Audit + Activity logging

### `auditService.ts` — extend `AUDIT_SCHEMA`:
```
subscription_purchased: required: ['action','adminId','adminName','details','targetId'],
                        metadata_fields: ['plan','periodEnd','source','amount','currency']
subscription_cancelled, subscription_paused, subscription_resumed,
subscription_refunded, subscription_comp_granted, subscription_force_cancelled
```

### `activityService.ts` — extend `ActivityEvent` union:
```
'subscription.purchased' | 'subscription.renewed' | 'subscription.cancelled'
| 'subscription.expired' | 'subscription.paused' | 'subscription.comp_granted'
```

---

## Edge cases

- **5 Business listings, sub lapses** → batch-flip to `paused_subscription` atomically (one tx per pro).
- **Active bookings on lapse** → honored end-to-end. Only new bookings blocked.
- **Webhook lost** → idempotent `subscriptionInvoices/{razorpayPaymentId}` doc + nightly reconciliation Cloud Function (`reconcileSubscriptions`).
- **Razorpay dispute** → admin marks `disputed`; sub auto-pauses pending resolution.
- **Residency revoked** → sub auto-cancelled, prorated NC refund as goodwill (one of the two refund cases honored).
- **Pro tries Razorpay then aborts modal** → no sub created (matches existing `coinPurchases` pattern).
- **Concurrent sub attempts** → guard via deterministic ID `sub_${uid}_${YYYYMM}` in `runTransaction`. Idempotent.
- **Admin grants comp while existing sub active** → comp extends `currentPeriodEnd`, marks `source='comp'`, no double-charge on auto-renew during comp window.
- **NC cashable balance computation race** → all sub debits inside `runTransaction` against ledger. Read-modify-write protected.
- **User with promo NC tries to subscribe** → Razorpay path enabled, NC path disabled w/ tooltip *"Subscriptions need cashable NC. Top up or use Razorpay."*

---

## Critical files (annotated by phase)

### NEW
| File | Phase | Purpose |
|---|---|---|
| `src/services/subscriptionService.ts` | P1 | client wrapper: `getSubscription(uid)`, `subscribeWithNC(uid)`, `subscribeWithRazorpay(uid)` (P2), `cancelSubscription`, `resumeSubscription`. Zod at boundary. |
| `src/services/subscriptionService.test.ts` | P1 | unit: idempotency, expiry math, cashable-balance gate |
| `src/pages/SubscriptionManage.tsx` | P1 | manage page (`/profile/subscription`) |
| `src/components/SubscribeSheet.tsx` | P1 | subscribe modal/bottom-sheet (NC-only at P1; Razorpay toggle added P2) |
| `src/components/SubscriptionBanner.tsx` | P1 | shared status banner (Profile + Wallet at P1; ProDetail at P2) |
| `src/components/ActiveProPill.tsx` | P2 | resident-side trust pill (BrowsePros + ProDetail) |
| `src/pages/admin/AdminSubscriptions.tsx` | P2 | full admin dashboard + actions (P1 uses AdminUsers extension only) |
| `functions/src/subscriptions.ts` | P2 | `subscribeWithNC` callable (hardened), `dailyRenewalSweep` `onSchedule`, `reconcileSubscriptions`, `degradeListings`, `adminSubscriptionAction` |
| `scripts/backfillBalanceBuckets.cjs` | P1 | one-time: backfill `cashableBalance`/`promoBalance` per user from ledger history |

### MODIFY
| File | Phase | Change |
|---|---|---|
| `src/constants/serviceCatalog.ts` | P1 | export `isBusinessCategory(category): boolean` |
| `src/services/coinService.ts` | P1 | add `LedgerType: 'subscription_debit'`, `CASHABLE_LEDGER_TYPES`, `PROMO_LEDGER_TYPES`, `getCashableBalance(uid)`. **P2:** denormalize buckets onto user doc inside ledger transactions; tighten `coinPayouts` to cashable-only. |
| `src/services/auditService.ts` | P1 | extend `AUDIT_SCHEMA` w/ subscription actions |
| `src/services/activityService.ts` | P1 | extend `ActivityEvent` union |
| `src/services/firestoreService.ts` | P1 | `createService` enforces sub gate; `getServicesByUser` filters `paused_subscription` for non-owners |
| `src/pages/Profile.tsx` | P1 | service form gate, status pill per Business listing row |
| `src/pages/Wallet.tsx` | P1 | Subscriptions section above ledger |
| `src/pages/admin/AdminUsers.tsx` | P1 | Subscription column + grant/revoke row action |
| `src/pages/admin/AdminSettings.tsx` | P1 | Subscription config tab (price, grace, founder promo flag) |
| `src/pages/admin/AdminServices.tsx` | P2 | Sub column dot + block approve on no-sub Business listing |
| `src/pages/BrowsePros.tsx` | P2 | Active Pro pill, filter `paused_subscription` |
| `src/pages/ProDetail.tsx` | P2 | Active Pro pill, disable book CTA on paused listing |
| `src/App.tsx` | P1 (one route) / P2 (admin route) | `/profile/subscription` (P1); `/admin/subscriptions` (P2) |
| `firestore.rules` | P1 | new `/subscriptions`, `/subscriptionInvoices` matches; extend `services` create gate; allow `subscription_debit` in ledger validate |
| `functions/src/index.ts` | P2 | extend `razorpayWebhook` to branch on `purpose`; export new subscription fns |
| `src/components/layout/NotificationCenter.tsx` | P2 | render new sub-related `wallet`-kind notifications |
| `src/pages/LandingPage.tsx` | P2 | optional copy: "Business listings include monthly subscription. Learn more." |

### DEFER (Phase 3 — post-launch)
- True Razorpay subscriptions/mandates (auto-debit INR via mandate)
- Multi-tier plans (Basic/Plus w/ featured-listing entitlement)
- Promo code system (extend payload + admin UI)
- Annual plan (12-month, 2 months free)
- A/B price test framework
- Society-sponsored listings (B2B revenue)
- Email/SMS receipts + PDF invoices
- Churn analytics dashboard

---

## Verification (per phase)

### Phase 1 (Spark, NC-only)
**Unit**
- `subscriptionService.test.ts`: idempotent renewals (`sub_${uid}_${YYYYMM}` collision), expiry math, cashable balance gate (promo NC rejected)
- `coinService.test.ts` extended: `subscription_debit` writes only against cashable types, `getCashableBalance` correctness on mixed ledger
- Rules snapshot test: `firestore.rules` Business literal list ↔ `CATEGORY_GROUPS.Business` parity

**Integration (MSW)**
- subscribe with NC happy path → ledger entry + sub doc + invoice doc + `users.subscription` denorm
- gate enforcement: Business `createService` blocked when `subscription.status` not active
- admin grant via AdminUsers row action → `auditLog` + `activityLog` written

**Manual**
- One-time backfill script `scripts/backfillBalanceBuckets.cjs` against staging — diff against current `coinBalance`
- Lazy expiry: set a sub to expired in DB, reload Profile → banner shows correct copy without server cron

### Phase 2 (Blaze, full release)
**Integration (MSW)**
- Razorpay webhook idempotency on duplicate `razorpayPaymentId`
- `dailyRenewalSweep` reminder cadence (T-3, T-1, T+0)
- expiry transition: `degradeListings` flips all Business listings of expired pro to `paused_subscription` atomically

**E2E (Playwright)** — `e2e/subscription.spec.ts`
1. Pro creates Business listing → blocked → subscribes (mocked Razorpay test mode) → listing submits
2. Subscribed pro renews via NC → period extended → ledger entry visible in Wallet
3. Sub expires → listing disappears from BrowsePros → pro reactivates → listing reappears
4. Admin comp → pro's status flips → AuditLog page shows event
5. `e2e/cashable-balance.spec.ts`: pro with promo-only NC sees Razorpay-only subscribe (NC option disabled with tooltip)

**Manual**
- Deploy `functions/src/subscriptions.ts` to Blaze → trigger cron manually via Cloud Console → confirm sweep
- Razorpay test-mode webhook delivery (POST /razorpayWebhook) → idempotent on retry
- Force-cancel via AdminSubscriptions → pro's listings flip + audit + notification all in ≤2s

### Phase 3
- Load test cron sweep at 10k subs
- Promo code redemption flow (separate test pack)

---

## Risks + open questions

1. **Rules drift** between hardcoded Business list in `firestore.rules` and `CATEGORY_GROUPS` → snapshot test mandatory at P1.
2. **Cashable-balance correctness on legacy users**: P1 backfill script `scripts/backfillBalanceBuckets.cjs` recomputes `cashableBalance` / `promoBalance` from full ledger history per user. Run in staging first; spot-check 10 users manually.
3. **Existing `coinPayouts` flow** likely lets users cash out promo NC today (per `NC_TERMS_DEFAULTS.refundPolicy` policy is stated but not enforced). Tighten payout to cashable-only at P2. **Audit pending payouts before rule change** — refund-credit promo-NC drainings if found.
4. **P1→P2 cron handoff**: P1 renders renewal banner using client-computed expiry. When Blaze cron lights up at P2, set `config/platformSettings.subscription.cronEnabled = true` to avoid dual lazy + cron double-debit. Cron checks the flag.
5. **Refund UX**: P2 admin records Razorpay refund reference manually. Auto-refund via Razorpay API = P3.
6. **Dispute handling**: leverage existing `disputes` collection with `bookingId = null, subscriptionId set`. Confirm `disputes` schema supports both keys (read `firestore.rules` `/disputes` match before P2 implementation).
7. **Pricing localization**: INR-only at launch. Multi-currency = far future.
8. **P1 ships without resident-side trust pill** (Active Pro pill is P2). Communicate to user that P1 is functionally complete but residents only see "subscribed" implicitly through *which listings exist*, not via badge.

### Open questions (set in Admin Settings post-P1)
- Exact monthly INR price (₹99/199/299/499)?
- Exact monthly NC price (300/500/750)?
- Founder promo cap and duration?
- Auto-debit-NC default ON or OFF?

### Open questions for you (can be set in Admin Settings post-launch)
- Exact monthly INR price (₹99/199/299/499)?
- Exact monthly NC price (300/500/750)?
- Founder promo cap and duration?
- Auto-debit-NC default ON or OFF?