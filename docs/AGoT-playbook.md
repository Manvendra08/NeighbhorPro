# ProNeighbor AGoT (Adaptive Graph of Thoughts) Playbook

> **Version**: 1.1 | **Last Updated**: June 29, 2026 | **Status**: Production-Ready

## Overview

This playbook provides a structured reasoning framework for analyzing, designing, and evolving the ProNeighbor codebase. It decomposes the architecture into interconnected reasoning nodes, evaluates design trade-offs, and guides decision-making for future development.

---

## Reasoning Graph Structure

### Level 1: Core Domains

```
ProNeighbor Architecture
├── [A] Identity & Access Management
├── [B] Service Marketplace Engine
├── [C] Financial Ledger System
├── [D] Booking Lifecycle Manager
├── [E] Subscription & Monetization
├── [F] Admin Governance Platform
└── [G] PWA & User Experience
```

### Level 2: Domain Decomposition

#### [A] Identity & Access Management
```
AuthContext.tsx
├── Authentication Methods
│   ├── Email/Password (Firebase Auth)
│   ├── Google OAuth
│   └── Phone OTP (India-focused)
├── Profile Management
│   ├── Firestore user document (private)
│   ├── Public profile mirror (read-optimized)
│   └── Residency verification workflow
├── Role-Based Access Control
│   ├── user: Standard resident/pro
│   └── admin: Platform management
└── Account Lifecycle
    ├── Signup with referral code
    ├── Email verification
    ├── Soft-delete → Hard-delete cascade
    └── Disabled account handling
```

**Key Design Decisions**:
- **Dual Profile Storage**: Private `users/{uid}` + public `publicProfiles/{uid}` for read performance
- **Referral Code Generation**: UID-based deterministic codes (collision-resistant)
- **Cascade Delete**: Admin-triggered hard delete across 13+ collections

**Trade-offs**:
- ✅ Pros: Separation of concerns, optimized queries for public data
- ❌ Cons: Data duplication, sync complexity via `mirrorPublicProfile()`

---

#### [B] Service Marketplace Engine
```
Service Discovery & Management
├── Service Catalog
│   ├── Dynamic categories (admin-configurable)
│   ├── Business vs Regular categories
│   └── Category icons & metadata
├── Service Listings
│   ├── Moderation workflow (pending → approved/featured/rejected)
│   ├── Subscription gating (Business categories require active sub)
│   └── Provider aggregation (rating, review count)
├── Search & Filtering
│   ├── Category, locality, price filters
│   ├── Verification status filter
│   └── Full-text search (client-side)
└── Provider Profiles
    ├── Skills, bio, hourly rate
    ├── Availability calendar
    └── Aggregated metrics (Cloud Function)
```

**Key Design Decisions**:
- **Moderation Queue**: All new services start as "pending", require admin approval
- **Subscription Gating**: Business category listings hidden if subscription expired
- **Rating Aggregation**: Cloud Function `onReviewWrite` recalculates on every review change

**Trade-offs**:
- ✅ Pros: Quality control via moderation, revenue via subscriptions
- ❌ Cons: Full collection scan for rating calc (scales poorly), manual approval bottleneck

---

#### [C] Financial Ledger System
```
NeighbourCoins Wallet
├── Dual-Bucket Balances
│   ├── cashableBalance (withdrawable)
│   └── promoBalance (earned bonuses)
├── Coin Packs (Razorpay integration)
│   ├── Trial: ₹300 → 300 NC
│   ├── Starter: ₹1000 → 1100 NC
│   ├── Popular: ₹1500 → 1700 NC ⭐
│   ├── Pro: ₹2000 → 2250 NC
│   └── Society: ₹2500 → 3000 NC
├── Earning Mechanisms (19 ledger types)
│   ├── Signup bonus: 500 NC
│   ├── Profile completion: 50 NC
│   ├── Referral: 200 NC (split flow)
│   ├── Review: 20 NC
│   └── Admin credits: Variable
├── Payout System
│   ├── Min 200 NC threshold
│   ├── UPI ID validation & masking
│   ├── Sentinel lock pattern (TOCTOU prevention)
│   └── Admin processing workflow
└── Transaction Safety
    ├── Idempotency keys (refId uniqueness)
    ├── runTransaction() for atomicity
    └── Zero-amount guards
```

**Key Design Decisions**:
- **Dual Buckets**: Prevents money laundering via earned bonuses
- **Sentinel Lock Pattern**: Prevents concurrent payout requests
- **Split Referral Flow**: Referrer rewarded at signup, referee at first booking

**Trade-offs**:
- ✅ Pros: Financial compliance, fraud prevention, audit clarity
- ❌ Cons: Complexity in balance calculations, user confusion about withdrawable vs non-withdrawable

---

#### [D] Booking Lifecycle Manager
```
Booking State Machine
├── States
│   ├── pending → confirmed → completed → reviewed
│   └── ↘ cancelled (from pending or confirmed)
├── Escrow Handling
│   ├── holdEscrow(): Deduct at booking creation
│   ├── releaseEscrow(): Credit pro after completion (15% platform fee)
│   └── refundEscrow(): Return to client on cancellation
├── Status Transitions
│   ├── Confirm: Pro only
│   ├── Cancel: Client or Pro (with refund)
│   ├── Complete: Pro only
│   └── Review: Client only
├── Atomic Operations
│   ├── cancelBookingAndRefund(): Single transaction
│   └── createBooking(): Escrow hold + booking creation
└── Edge Cases
    ├── Zero-escrow bookings (free consultations)
    ├── Double-booking prevention (availability check)
    └── Re-completion guard (escrowStatus check)
```

**Key Design Decisions**:
- **Escrow Model**: Coins held until service completion (trust mechanism)
- **Atomic Cancellation**: Prevents partial failure (status update without refund)
- **Platform Fee**: 15% deducted from pro earnings (stored at booking time)

**Trade-offs**:
- ✅ Pros: Trust between strangers, platform revenue, dispute protection
- ❌ Cons: Pro cash flow delay, complexity in refund logic

---

#### [E] Subscription & Monetization
```
Business Listing Subscriptions
├── Plans
│   ├── Trial: 30 days free
│   ├── 3 Months: 999 NC (333/mo)
│   ├── 6 Months: 1799 NC (300/mo) ✨ Best value
│   └── 12 Months: 2299 NC (192/mo)
├── Payment Model
│   ├── NC-only (no Razorpay for subs)
│   ├── Cashable balance only (no promo coins)
│   └── Server-side debit (Cloud Function)
├── Lifecycle Management
│   ├── Trial activation (one-time per user)
│   ├── Renewal reminders (T-7, T-3, T-1)
│   ├── Grace period (5 days past due)
│   └── Expiry → Pause listings
├── Cloud Functions (Blaze-required)
│   ├── subscribeWithNCCallable
│   ├── activateTrialCallable
│   ├── dailyRenewalSweep (scheduled)
│   └── adminSubscriptionAction
└── Admin Controls
    ├── Grant complimentary subscriptions
    ├── Pause/force-cancel
    └── Dynamic pricing (config-driven)
```

**Key Design Decisions**:
- **NC-Only Payments**: Simplifies subscription flow, drives coin purchases
- **Cashable-Only Rule**: Ensures real monetary commitment for recurring revenue
- **Scheduled Sweep**: Automated expiry processing with grace period

**Trade-offs**:
- ✅ Pros: Predictable revenue, automated lifecycle, flexible pricing
- ❌ Cons: Blaze plan required, users must top up wallet for renewals

---

#### [F] Admin Governance Platform
```
Admin Panel (11 Pages)
├── User Management
│   ├── Role changes (with confirmation modal)
│   ├── Disable/enable accounts
│   ├── Residency verification queue
│   └── Cascade delete (hard delete across collections)
├── Service Moderation
│   ├── Approve/reject/feature listings
│   ├── Bulk actions with reason logging
│   ├── Category management (add/remove/rename)
│   └── Export CSV
├── Financial Oversight
│   ├── Payout processing
│   ├── Ledger adjustments (idempotent)
│   ├── Coin economy summary
│   └── Manual credits/debits
├── Subscription Admin
│   ├── KPI dashboard
│   ├── Grant/revoke subscriptions
│   └── Force-cancel with audit
├── Audit & Compliance
│   ├── Append-only audit log
│   ├── Self-targeting prevention
│   └── Activity log viewer
└── Platform Configuration
    ├── Service categories
    ├── Commission rate
    ├── Subscription pricing
    └── Cron enable/disable
```

**Key Design Decisions**:
- **Audit Trail**: All destructive actions logged with admin ID, target, timestamp
- **Self-Targeting Prevention**: Admins cannot modify their own accounts for sensitive actions
- **Confirmation Modals**: Required for role escalation, bulk operations, deletions

**Trade-offs**:
- ✅ Pros: Accountability, compliance, operational transparency
- ❌ Cons: UI complexity, performance overhead for audit writes

---

#### [G] PWA & User Experience
```
Progressive Web App
├── Service Worker
│   ├── Cache name: proneighbor-v3-*
│   ├── Network-first for HTML
│   └── Cache-first for static assets
├── Install Prompts
│   ├── PWAInstallBanner component
│   └── PWASplashScreen for standalone launch
├── Responsive Design
│   ├── Desktop: Sidebar layout
│   ├── Tablet: responsive.css
│   └── Mobile: mobile.css
├── Real-Time Features
│   ├── Firestore onSnapshot for profiles
│   ├── Notifications collection polling
│   └── Push notifications (FCM)
└── Performance Optimization
    ├── Vite chunk splitting
    ├── React Query caching
    └── Lazy loading for heavy components
```

**Key Design Decisions**:
- **PWA-First**: Installable app experience without native development
- **Modular CSS**: Separate files for desktop, tablet, mobile, dark mode
- **Cache Strategy**: Balance freshness (network-first HTML) with speed (cache-first assets)

**Trade-offs**:
- ✅ Pros: Cross-platform, offline support, fast subsequent loads
- ❌ Cons: Limited native features (push notifications require FCM setup), cache invalidation complexity

---

## Design Trade-off Analysis

### Trade-off 1: Firebase-Native vs Custom Backend

**Decision**: Firebase-native architecture (Firestore, Auth, Cloud Functions)

**Pros**:
- Rapid development (no server infrastructure)
- Real-time capabilities out-of-the-box
- Automatic scaling
- Integrated security rules

**Cons**:
- Vendor lock-in
- Limited query flexibility (no JOINs, complex aggregations expensive)
- Cold starts for Cloud Functions
- Blaze plan required for advanced features

**When to Reconsider**:
- If query complexity grows beyond Firestore capabilities
- If cost exceeds custom backend at scale
- If multi-cloud strategy needed

---

### Trade-off 2: Dual-Bucket Wallet vs Single Balance

**Decision**: Dual-bucket (cashable + promo)

**Pros**:
- Financial compliance (only real-money coins withdrawable)
- Clear audit trail
- Prevents bonus exploitation

**Cons**:
- User confusion ("Why can't I withdraw my 500 NC?")
- Complex balance calculations
- More Firestore reads/writes

**Mitigation**:
- Clear UI labeling (💳 Cashable vs 🎁 Bonus)
- Wallet overview card showing breakdown
- FAQ/tooltips explaining the difference

---

### Trade-off 3: Client-Side vs Server-Side Validation

**Decision**: Hybrid approach (Zod on client, Firestore rules as final gate)

**Pros**:
- Fast feedback for users (client-side)
- Security enforced server-side (Firestore rules)
- Defense in depth

**Cons**:
- Duplicate validation logic
- Rules can be hard to debug
- Client can still attempt invalid writes (wasted network calls)

**Best Practice**:
- Zod schemas at service boundaries
- Firestore rules as single source of truth
- Never trust client-side validation alone

---

### Trade-off 4: Moderation Queue vs Auto-Approval

**Decision**: Manual moderation for all new services

**Pros**:
- Quality control
- Fraud prevention
- Curated marketplace

**Cons**:
- Admin bottleneck
- Delayed listing activation
- Operational overhead

**Future Enhancement**:
- AI-assisted moderation (image/text analysis)
- Trusted provider auto-approval after N successful bookings
- Community reporting for post-approval issues

---

### Trade-off 5: Escrow Model vs Direct Payment

**Decision**: Escrow (coins held until completion)

**Pros**:
- Trust mechanism for strangers
- Dispute resolution leverage
- Platform fee collection guaranteed

**Cons**:
- Pro cash flow delay
- Complexity in refund logic
- User friction (coins "locked")

**Alternative Considered**:
- Direct payment with refund guarantee
- Rejected due to higher fraud risk in anonymous marketplace

---

## Decision Framework for Future Features

### Question Tree

```
New Feature Request
│
├── Does it involve financial transactions?
│   ├── Yes → Use runTransaction() + idempotency keys
│   │         → Log to coinLedger
│   │         → Add audit event if admin-triggered
│   └── No → Continue
│
├── Does it modify user data?
│   ├── Yes → Validate with Zod schema
│   │         → Check Firestore rules compatibility
│   │         → Invalidate React Query cache after mutation
│   └── No → Continue
│
├── Is it admin-facing?
│   ├── Yes → Add captureAuditEvent() call
│   │         → Require confirmation dialog for destructive actions
│   │         → Prevent self-targeting if sensitive
│   └── No → Continue
│
├── Does it require real-time updates?
│   ├── Yes → Use Firestore onSnapshot or Cloud Functions trigger
│   └── No → Use standard getDocs/getDoc
│
├── Will it scale to 10K+ users?
│   ├── Yes → Avoid full collection scans
│   │         → Use composite indexes
│   │         → Consider pagination/cursor-based queries
│   └── No → Simple queries acceptable
│
└── Is it PWA-critical?
    ├── Yes → Test offline behavior
    │         → Ensure service worker caches correctly
    └── No → Standard web behavior
```

---

## Common Pitfalls & Anti-Patterns

### ❌ Anti-Pattern 1: Mixing Cashable and Promo Balances

**Bad**:
```typescript
// Subscription payment using total balance
if (user.coinBalance < plan.priceNC) throw new Error("Insufficient");
```

**Good**:
```typescript
// Subscription payment using cashable only
if (user.cashableBalance < plan.priceNC) throw new Error("INSUFFICIENT_CASHABLE_BALANCE");
```

---

### ❌ Anti-Pattern 2: Pre-Transaction Checks

**Bad**:
```typescript
const existing = await getDocs(query(...));
if (!existing.empty) return;
await runTransaction(db, async tx => { /* ... */ });
```

**Good**:
```typescript
await runTransaction(db, async tx => {
  const existing = await tx.get(doc(...)); // Part of tx read set
  if (existing.exists()) return;
  // ... write operations
});
```

---

### ❌ Anti-Pattern 3: Silent Error Handling

**Bad**:
```typescript
try {
  await someOperation();
} catch (e) {
  // Silently ignore
}
```

**Good**:
```typescript
try {
  await someOperation();
} catch (e) {
  captureError(e, { operation: "some_operation" });
  showToast("Operation failed. Please try again.", "error");
}
```

---

### ❌ Anti-Pattern 4: Direct Firestore Writes from Components

**Bad**:
```typescript
// In component
await updateDoc(doc(db, "users", uid), { coinBalance: newBal });
```

**Good**:
```typescript
// In component
await topUpCoins(uid, priceRs, coins, packLabel, paymentId);

// In service
export async function topUpCoins(...) {
  await runTransaction(db, async tx => {
    // Validation + write + ledger entry
  });
}
```

---

### ❌ Anti-Pattern 5: Ignoring Idempotency

**Bad**:
```typescript
// No deduplication key
tx.set(ledgerRef, { type: "topup", amount: coins });
```

**Good**:
```typescript
// Idempotency via refId
const ledgerEntryId = `${paymentId}_topup`;
const existing = await tx.get(doc(db, "coinLedger", uid, "entries", ledgerEntryId));
if (existing.exists()) return;
tx.set(ledgerRef, { type: "topup", amount: coins, refId: paymentId });
```

---

## Testing Strategy Matrix

| Feature | Unit Test | Integration Test | E2E Test | Priority |
|---------|-----------|------------------|----------|----------|
| Coin top-up | ✅ | ✅ | ✅ | Critical |
| Booking creation | ✅ | ✅ | ✅ | Critical |
| Escrow release | ✅ | ✅ | ✅ | Critical |
| Payout request | ✅ | ✅ | ✅ | Critical |
| Referral flow | ✅ | ✅ | ⚠️ Partial | High |
| Subscription purchase | ✅ | ✅ | ✅ | High |
| Admin user deletion | ⚠️ Partial | ⚠️ Partial | ❌ Missing | Medium |
| Service moderation | ⚠️ Partial | ⚠️ Partial | ❌ Missing | Medium |
| Notification delivery | ❌ Missing | ❌ Missing | ❌ Missing | Low |

**Coverage Gaps to Address**:
1. Admin wallet adjustment flows
2. Concurrent payout race conditions (stress test)
3. Subscription auto-renewal (not yet implemented)
4. Message service end-to-end
5. Push notification delivery

---

## Evolution Roadmap

### Phase 1: Stability & Coverage (Current)
- [ ] Increase test coverage to 80%+ for critical paths
- [ ] Fix timezone bug in rebook date picker
- [ ] Resolve platform fee mismatch (10% vs 15%)
- [ ] Add E2E tests for admin flows

### Phase 2: Scale & Automation (Next Quarter)
- [ ] Implement incremental rating counter (replace full collection scan)
- [ ] Add subscription auto-renewal
- [ ] Enable AI-assisted service moderation
- [ ] Optimize Firestore indexes for complex queries

### Phase 3: Growth & Engagement (6 Months)
- [ ] Launch Phase 2 earning mechanisms (group sessions, on-demand)
- [ ] Implement loyalty tiers (Bronze/Silver/Gold/Diamond)
- [ ] Add coin gifting between users
- [ ] Build analytics dashboard for admins

### Phase 4: Platform Expansion (12 Months)
- [ ] Multi-society support (cross-community bookings)
- [ ] Corporate partnerships (bulk coin purchases)
- [ ] API for third-party integrations
- [ ] Native mobile apps (React Native)

---

## Monitoring & Observability

### Sentry Integration
- **Error Tracking**: Unhandled promise rejections, uncaught exceptions
- **Performance Monitoring**: Page load times, API latency
- **Custom Context**: Operation tags for feature-level debugging

### Activity Logs (User Actions)
- 25 event types tracked
- Rate-limited to prevent abuse
- Used for user behavior analytics

### Audit Logs (Admin Actions)
- Append-only collection
- Prevents self-targeting on sensitive actions
- Required for compliance

### Key Metrics to Monitor
1. **Coin Velocity**: Purchase → Spend → Payout cycle time
2. **Booking Conversion**: Browse → Book → Complete funnel
3. **Subscription Churn**: Trial → Active → Expired rates
4. **Admin Response Time**: Verification queue aging
5. **Error Rate**: Sentry error frequency by feature

---

## Collaboration Guidelines

### For New Developers
1. **Read AGENTS.md**: Project conventions, common pitfalls
2. **Understand Service Layer Pattern**: Zod validation → Firebase operation → Error handling
3. **Follow File Size Limits**: Split files >600 lines
4. **Write Tests First**: Especially for financial logic
5. **Check BUGS.md**: Known issues before implementing related features

### Code Review Checklist
- [ ] Zod schema validation at boundaries
- [ ] Idempotency keys for financial operations
- [ ] Audit logging for admin actions
- [ ] React Query cache invalidation after mutations
- [ ] Error handling with user-friendly messages
- [ ] No console.log in production code
- [ ] TypeScript strict mode compliance (no `any`)

### Deployment Checklist
- [ ] Run `npm run test` (all unit/integration tests pass)
- [ ] Run `npm run test:e2e` (critical flows verified)
- [ ] Check Sentry for new errors in staging
- [ ] Verify Firestore rules deployed
- [ ] Confirm Cloud Functions deployed (if changed)
- [ ] Test PWA install prompt on mobile
- [ ] Verify Razorpay webhook endpoint (if payment changes)

---

## Glossary

| Term | Definition |
|------|------------|
| **NC** | NeighbourCoin (1 NC = ₹1) |
| **Cashable Balance** | Real-money sourced coins (withdrawable) |
| **Promo Balance** | Earned bonus coins (non-withdrawable) |
| **Escrow** | Coins held until booking completion |
| **TOCTOU** | Time-of-check-time-of-use (race condition) |
| **Idempotency Key** | Unique identifier to prevent duplicate processing |
| **Sentinel Document** | Lock mechanism for concurrent operation prevention |
| **Blaze Plan** | Firebase pay-as-you-go plan (required for Cloud Functions) |
| **Spark Plan** | Firebase free tier (limited Cloud Functions) |
| **PWA** | Progressive Web App (installable web application) |

---

## References

- **AGENTS.md**: Developer guidelines and conventions
- **BUGS.md**: Active issue tracking
- **AUDIT_REPORT.md**: Comprehensive code audit findings
- **firestore.rules**: Security rules (single source of truth for access control)
- **functions/src/**: Cloud Functions implementation
- **src/services/**: Service layer implementations
- **docs/architecture.md**: System architecture overview
- **docs/order-flow.md**: Booking lifecycle documentation
- **docs/strategies/options-engine.md**: Subscription engine documentation
- **docs/Functional-Specification.md**: Complete feature specification
- **docs/USER-GUIDE.md**: End-user documentation and guides
