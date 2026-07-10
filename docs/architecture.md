# ProNeighbor Architecture

> **Version**: 2.1 | **Last Updated**: June 29, 2026 | **Status**: Production-Ready

---

## Executive Summary

ProNeighbor is a **gated-community service marketplace PWA** that connects verified residents with local professionals. The platform uses a proprietary virtual currency called **NeighbourCoins (NC)** for transactions, with a dual-bucket wallet system that separates cashable (real-money sourced) coins from promotional (earned) coins.

### Core Value Proposition
- **Trust-first**: All professionals are residency-verified within gated communities
- **Escrow-based transactions**: Coins held until service completion, protecting both parties
- **Community-driven**: Local feed, reviews, and referral system foster neighborhood engagement
- **PWA-native**: Installable, offline-capable, push-notification enabled

### Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React 18 + Vite)                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Presentation Layer  │  State Layer       │  Service Layer                      │
│  ├─ Pages            │  ├─ AuthContext     │  ├─ bookingService.ts              │
│  ├─ Components       │  ├─ React Query    │  ├─ coinService.ts                 │
│  └─ Layout           │  └─ Local State    │  ├─ subscriptionService.ts         │
│                      │                    │  ├─ userService.ts                 │
│                      │                    │  ├─ messageService.ts              │
│                      │                    │  ├─ reviewService.ts               │
│                      │                    │  ├─ feedService.ts                 │
│                      │                    │  ├─ supportService.ts              │
│                      │                    │  ├─ auditService.ts                │
│                      │                    │  └─ activityService.ts             │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Firebase Client SDK
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FIREBASE BACKEND (GCP)                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Firebase Auth          │  Firestore Database    │  Cloud Functions            │
│  ├─ Email/Password      │  ├─ users              │  ├─ onReviewWrite (Spark)   │
│  ├─ Google OAuth        │  ├─ publicProfiles     │  ├─ subscribeWithNCCallable │
│  └─ Phone OTP           │  ├─ bookings           │  ├─ activateTrialCallable   │
│                         │  ├─ services           │  ├─ dailyRenewalSweep       │
│  Firebase Storage       │  ├─ coinLedger         │  └─ adminSubscriptionAction │
│  ├─ Profile photos      │  ├─ subscriptions      │                             │
│  ├─ Residency proofs    │  ├─ messages           │  Firebase Hosting           │
│  └─ Booking attachments │  ├─ localFeed          │  ├─ PWA assets              │
│                         │  ├─ tickets            │  └─ Service worker          │
│  Firebase Messaging     │  ├─ auditLogs          │                             │
│  └─ Push notifications  │  └─ config             │  External Services          │
│                         │                        │  ├─ Razorpay (payments)     │
│                         │                        │  ├─ Cloudinary (images)     │
│                         │                        │  └─ Sentry (monitoring)     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Reasoning Graph: Domain Interconnections

The architecture decomposes into **7 interconnected domains**. Each domain has clear boundaries but communicates through well-defined interfaces.

```
                    ┌─────────────────────┐
                    │  [A] IDENTITY &     │
                    │      ACCESS MGMT    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ [B] MARKET- │   │ [C] FINANC- │   │ [D] BOOKING │
    │   PLACE     │──▶│   IAL       │──▶│  LIFECYCLE  │
    │   ENGINE    │   │   LEDGER    │   │   MANAGER   │
    └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
           │                 │                 │
           │                 │                 │
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ [E] SUBSCR- │   │ [F] ADMIN   │   │ [G] PWA &   │
    │   IPTION &  │   │   GOVERN-   │   │   REAL-TIME │
    │ MONETIZATION│   │   ANCE      │   │   UX        │
    └─────────────┘   └─────────────┘   └─────────────┘
```

### Domain Dependency Matrix

| From \ To | A | B | C | D | E | F | G |
|-----------|---|---|---|---|---|---|---|
| **A** Identity | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **B** Marketplace | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| **C** Financial | — | — | — | ✓ | ✓ | ✓ | ✓ |
| **D** Booking | — | — | ✓ | — | — | ✓ | ✓ |
| **E** Subscription | — | ✓ | ✓ | — | — | ✓ | ✓ |
| **F** Admin | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| **G** PWA/UX | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |

### Data Flow Patterns

**Pattern 1: Write-Through Cache (Profile Mirror)**
```
User updates profile → users/{uid} updated → publicProfiles/{uid} mirrored
                                              ↓
                                    BrowsePros reads from publicProfiles
                                    (fast, no auth-sensitive data)
```

**Pattern 2: Escrow State Machine**
```
Client creates booking
  → coinBalance debited (escrow held)
  → booking.status = "pending", escrowStatus = "held"
  
Pro confirms → booking.status = "confirmed"
Pro completes → releaseEscrow()
  → coinBalance credited to pro (minus 15% platform fee)
  → escrowStatus = "released"
  
OR

Cancel → refundEscrow()
  → coinBalance credited back to client
  → escrowStatus = "refunded"
```

**Pattern 3: Event-Driven Aggregation**
```
Review written → onReviewWrite Cloud Function triggers
  → Fetches all reviews for pro
  → Calculates average rating
  → Updates users/{proId}.rating + publicProfiles/{proId}.rating
```

---

## Architectural Layers

### 1. Presentation Layer (`src/components/`, `src/pages/`)

#### Component Organization
```
src/components/
├── auth/              # Authentication pages and guards
│   ├── AuthPages.tsx         # Login, Register, ForgotPassword
│   ├── ProtectedRoute.tsx    # RBAC enforcement
│   └── EmailVerifiedPage.tsx
├── common/            # Reusable UI primitives
│   ├── Avatar.tsx
│   ├── EmptyState.tsx
│   ├── FormField.tsx
│   ├── ProCard.tsx
│   └── SkeletonLoader.tsx
├── dashboard/         # Dashboard-specific components
│   ├── BookingPipeline.tsx
│   ├── FeedComposer.tsx
│   ├── RecommendedPros.tsx
│   ├── SmartGreeting.tsx
│   └── WeekStrip.tsx
├── layout/            # App shell
│   ├── Layout.tsx
│   ├── Sidebar.tsx
│   ├── TopBar.tsx
│   └── NotificationCenter.tsx
└── [Feature].tsx      # SubscribeSheet, PWAInstallBanner, etc.

src/pages/
├── admin/             # 11 admin management pages
├── BookingFlow.tsx    # Multi-step booking wizard
├── BrowsePros.tsx     # Service discovery
├── Dashboard.tsx      # Role-adaptive dashboard
├── Messages.tsx       # Real-time chat
├── Wallet.tsx         # Coin management
└── ...
```

**File Size Convention**: Target 200-400 lines per file; split at ~600 lines.

#### Routing Structure
```typescript
// Public routes (no auth required)
/                    → LandingPage
/login               → LoginPage
/register            → RegisterPage
/forgot-password     → ForgotPasswordPage
/email-verified      → EmailVerifiedPage
/terms               → TermsOfService
/privacy             → PrivacyPolicy
/contact             → Contact

// Protected user routes (require authentication)
/dashboard           → Dashboard (userOnly)
/browse              → BrowsePros (userOnly)
/pro/:id             → ProDetail (userOnly)
/book/:id            → BookingFlow (userOnly)
/bookings            → MyBookings (userOnly)
/bookings/:id        → BookingDetail (userOnly)
/wallet              → Wallet
/subscription        → SubscriptionManage
/account             → MyAccount
/messages            → Messages
/support             → Support

// Protected admin routes (require admin role)
/admin               → AdminDashboard (adminOnly)
/admin/users         → AdminUsers (adminOnly)
/admin/services      → AdminServices (adminOnly)
/admin/bookings      → AdminBookings (adminOnly)
/admin/wallet        → AdminWallet (adminOnly)
/admin/subscriptions → AdminSubscriptions (adminOnly)
/admin/tickets       → AdminTickets (adminOnly)
/admin/audit         → AdminAuditLog (adminOnly)
/admin/settings      → AdminSettings (adminOnly)
/admin/societies     → AdminSocieties (adminOnly)
/admin/broadcast     → AdminBroadcast (adminOnly)
/admin/reviews       → AdminReviews (adminOnly)
```

### 2. State Management Layer

#### Decision Tree
```
State Type?
├── Auth state → useAuth() from AuthContext
│   └── Wraps Firebase Auth + Firestore profile (onSnapshot real-time)
├── Server data → TanStack Query hooks
│   ├── Profiles: 5min stale time
│   ├── Services: 2min stale time
│   └── Balances: 30s stale time
├── UI state → Local useState (modals, filters, form inputs)
└── Theme/global → Context (currently only auth uses global Context)
```

#### Query Client Configuration (`src/lib/queryClient.ts`)
```typescript
export const queryKeys = {
  publicProfile: (uid: string) => ["profiles", "public", uid],
  servicesByUser: (uid: string) => ["services", "user", uid],
  allServices: (limit: number) => ["services", "all", limit],
  coinBalance: (uid: string) => ["wallet", "balance", uid],
  dashboardUserBookings: (uid: string) => ["dashboard", "bookings", uid],
  dashboardLedger: (uid: string) => ["dashboard", "ledger", uid],
};

// Cache durations
PROFILE_STALE_TIME = 5 * 60 * 1000;   // 5 minutes
SERVICES_STALE_TIME = 2 * 60 * 1000;  // 2 minutes
BALANCE_STALE_TIME = 30 * 1000;       // 30 seconds
```

**Cache Invalidation Strategy**:
```typescript
// After mutations, invalidate related queries
queryClient.invalidateQueries({ queryKey: ["wallet", "balance", uid] });
queryClient.invalidateQueries({ queryKey: ["services", "user", uid] });
```

### 3. Service Layer (`src/services/`)

All services follow a consistent pattern:
1. **Validate** inputs with Zod schemas
2. **Execute** Firebase operations (often within `runTransaction`)
3. **Handle errors** with user-friendly messages
4. **Return typed results** inferred from schema

#### Core Services

| Service | Responsibility | Key Functions |
|---------|---------------|---------------|
| `coinService.ts` | Wallet ledger, dual-bucket tracking, payouts | `holdEscrow()`, `releaseEscrow()`, `requestPayout()`, `topUpCoins()` |
| `bookingService.ts` | Booking lifecycle management | `createBooking()`, `updateBookingStatus()`, `cancelBookingAndRefund()` |
| `subscriptionService.ts` | Business listing subscriptions | `activateTrial()`, `subscribeWithNC()`, `cancelSubscription()` |
| `userService.ts` | Profile CRUD, public profile mirror | `getUserProfile()`, `updateUserProfile()`, `listProfessionals()` |
| `messageService.ts` | Real-time chat with deterministic IDs | `getOrCreateConversation()`, `sendMessage()`, `subscribeToMessages()` |
| `reviewService.ts` | Review submission and aggregation | `addReview()`, `getReviewsForUser()`, `recalculateProRating()` |
| `feedService.ts` | Community feed posts and reactions | `createFeedPost()`, `toggleReactionToFeedPost()`, `reportFeedPost()` |
| `supportService.ts` | Support tickets and disputes | `createTicket()`, `raiseDispute()`, `getFAQs()` |
| `auditService.ts` | Admin action audit trail | `captureAuditEvent()` with self-targeting prevention |
| `activityService.ts` | User activity logging (25 event types) | `logActivity()` with rate limiting |
| `razorpayService.ts` | Payment integration | `initiateTopUp()` with SDK loading |
| `notificationService.ts` | FCM push notifications | `registerPushNotifications()`, `listenForForegroundMessages()` |
| `platformService.ts` | Platform settings and availability | `getPlatformSettings()`, `updateProAvailability()` |
| `societyService.ts` | Society management | `createSociety()`, `getAllSocieties()` |
| `serviceService.ts` | Service listing CRUD | `createService()`, `getServicesByUser()`, `getAllServices()` |

#### Critical Transactional Patterns

**Pattern 1: Idempotency Keys**
```typescript
// Prevent duplicate processing on network retries
const ledgerEntryId = `${bookingId}_hold_${clientUid}`;
const ledgerRef = doc(db, "coinLedger", clientUid, "entries", ledgerEntryId);
const existingEntry = await tx.get(ledgerRef);
if (existingEntry.exists()) return; // Skip if already processed
```

**Pattern 2: Sentinel Documents (TOCTOU Prevention)**
```typescript
// Prevent concurrent payout requests
await runTransaction(db, async tx => {
  const sentinelRef = doc(db, "payoutLock", uid);
  const sentinelSnap = await tx.get(sentinelRef); // Part of tx read set
  if (sentinelSnap.exists() && sentinelSnap.data()?.status === "pending") {
    throw new Error("DUPLICATE_PAYOUT");
  }
  // ... write payout and sentinel atomically
  tx.set(sentinelRef, { uid, status: "pending", payoutId: ... });
});
```

**Pattern 3: Dual-Bucket Balance Tracking**
```typescript
// cashableBalance: Real-money sourced (top-ups, booking earnings, refunds)
// promoBalance: Earned bonuses (referrals, reviews, milestones)
// coinBalance: Total balance (cashable + promo)

// Only cashableBalance can be withdrawn or used for subscriptions
if (user.cashableBalance < plan.priceNC) {
  throw new Error("INSUFFICIENT_CASHABLE_BALANCE");
}
```

**Pattern 4: Atomic State Transitions**
```typescript
// Cancel booking + refund escrow in single transaction
await runTransaction(db, async tx => {
  // 1. Read booking
  const bookingSnap = await tx.get(bookingRef);
  
  // 2. Validate state
  if (data.status === "cancelled") throw new Error("ALREADY_FINALIZED");
  
  // 3. Mark as cancelled
  tx.update(bookingRef, { status: "cancelled" });
  
  // 4. Refund escrow if held
  if (escrowCoins > 0 && escrowStatus === "held") {
    tx.update(userRef, { coinBalance: newBal, cashableBalance: newCashable });
    tx.set(ledgerRef, { type: "booking_refund", amount: escrowCoins });
  }
});
```

### 4. Backend Layer (Firebase Cloud Functions)

Located in `functions/src/`:

| Function | Trigger | Purpose | Plan Requirement |
|----------|---------|---------|------------------|
| `onReviewWrite` | Firestore trigger on `reviews/{reviewId}` | Recalculates pro rating/review count | Spark |
| `subscribeWithNCCallable` | HTTPS callable | Server-side NC debit for subscription | Blaze |
| `activateTrialCallable` | HTTPS callable | Enroll free trial | Blaze |
| `dailyRenewalSweep` | Scheduled (02:00 IST daily) | Renewal reminders + expiry processing | Blaze |
| `adminSubscriptionAction` | HTTPS callable | Admin comp/pause/force-cancel | Blaze |

**Blaze Plan Requirement**: Subscription Cloud Functions require Firebase Blaze plan due to scheduled triggers and HTTPS callables.

### 5. Data Layer (Firestore Collections)

#### Primary Collections

| Collection | Purpose | Key Fields | Access Pattern |
|-----------|---------|------------|----------------|
| `users` | User profiles with denormalized subscription | `role`, `coinBalance`, `cashableBalance`, `subscription.status` | Owner + Admin |
| `publicProfiles` | Public-safe profile mirror | `displayName`, `photoURL`, `rating`, `isServiceProvider` | Any signed-in user |
| `services` | Service listings with moderation | `status`, `subStatus`, `category`, `userId` | Read: signed-in; Write: owner |
| `bookings` | Booking lifecycle with escrow | `status`, `escrowCoins`, `escrowStatus`, `coinsPaid` | Participants + Admin |
| `coinLedger/{uid}/entries` | Coin transaction history (19 types) | `type`, `amount`, `balanceAfter`, `refId` | Owner + Admin |
| `subscriptions` | Business listing subscriptions | `status`, `plan`, `currentPeriodStart/End`, `source` | Owner + Admin |
| `subscriptionInvoices` | Paid subscription invoices (immutable) | `subId`, `amount`, `paymentMethod`, `ledgerEntryId` | Owner + Admin |
| `messages/{convId}/chats` | Real-time chat messages | `senderId`, `text`, `timestamp`, `attachmentUrl` | Conversation participants |
| `localFeed` | Community feed posts | `authorId`, `content`, `locality`, `likeCount` | Signed-in users |
| `tickets` | Support tickets | `uid`, `status`, `category`, `ticketNumber` | Owner + Admin |
| `disputes` | Booking disputes | `bookingId`, `raisedByUid`, `againstUid`, `status` | Participants + Admin |
| `auditLogs` | Admin action audit trail (append-only) | `action`, `adminId`, `targetId`, `metadata` | Admin only |
| `activityLogs` | User activity events | `userId`, `event`, `details`, `timestamp` | Admin only |
| `notifications` | Real-time notifications (6 kinds) | `uid`, `kind`, `title`, `body`, `read` | Owner |
| `config/platformSettings` | Platform configuration | `serviceCategories`, `sub3mPriceNC`, `cronEnabled` | Read: signed-in; Write: Admin |
| `societies` | Gated community registry | `name`, `city`, `memberCount` | Read: all; Write: Admin |
| `referralCodes` | Referral code registry | `uid`, `code` | Read: signed-in; Write: owner |
| `referrals` | Referral tracking | `newUserUid`, `referrerUid`, `status` | Owner + Admin |
| `coinPurchases` | Razorpay payment records | `uid`, `amountPaid`, `coinsGranted`, `status` | Owner + Admin |
| `coinPayouts` | Payout requests | `uid`, `coinsRedeemed`, `amountRs`, `status` | Owner + Admin |
| `payoutLock` | Sentinel docs for payout locking | `uid`, `status`, `payoutId`, `generation` | Owner (read); Service layer (write) |
| `proAvailability` | Pro availability calendar | `monday`, `tuesday`, ... `sunday` | Read: signed-in; Write: owner |
| `faqs` | Dynamic FAQ content | `question`, `answer`, `category`, `order`, `active` | Read: signed-in; Write: Admin |
| `reports` | Professional reports | `proId`, `reporterId`, `reason`, `status` | Reporter + Admin |
| `reviews` | Professional reviews | `bookingId`, `proId`, `clientId`, `rating`, `comment` | Signed-in (read); Client (create) |
| `residentReviews` | Pro-to-resident reviews | `bookingId`, `clientId`, `proId`, `rating` | Signed-in (read); Pro (create) |
| `transactions` | Transaction history (legacy) | `proId`, `amount`, `proEarning` | Admin only |
| `announcements` | Platform announcements | `title`, `body`, `createdAt` | Read: signed-in; Write: Admin |
| `appSettings` | App-wide settings | `ncTerms`, `adminStats` | Read: signed-in; Write: Admin |

#### Ledger Entry Types (19 total)

**Cashable Types** (can be withdrawn):
- `topup` — Razorpay coin purchase
- `booking_escrow_release` — Earnings from completed booking
- `booking_refund` — Refund from cancelled booking

**Promo Types** (non-withdrawable):
- `earn_signup_bonus` — 500 NC welcome bonus
- `earn_profile` — 50 NC for profile completion
- `earn_referral` — 200 NC for referral (split flow)
- `earn_review` — 20 NC for writing review
- `earn_free_consult` — 100 NC for free consultation given
- `earn_milestone` — 50 NC community milestone
- `earn_groupsession` — 25 NC group session attended
- `earn_ondemand` — 50 NC on-demand request fulfilled
- `admin_credit` — Admin manual credit

**Neutral Types** (balance-neutral or deductions):
- `booking_debit` — Booking payment (legacy)
- `booking_escrow` — Coins held in escrow
- `payout` — Payout processed (deduction)
- `payout_cancelled` — Payout cancelled (refund)
- `admin_debit` — Admin manual debit
- `subscription_debit` — Business subscription payment

---

## Security Model

### Defense-in-Depth Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Client-Side Validation (Zod schemas)              │
│  └─ Fast feedback, prevents invalid requests                │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Service Layer Validation                          │
│  └─ Business logic checks, authorization                    │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Firestore Security Rules                          │
│  └─ Final gate, enforces access control server-side         │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Cloud Functions (Blaze plan)                      │
│  └─ Server-side logic for sensitive operations              │
└─────────────────────────────────────────────────────────────┘
```

### Firestore Rules Architecture

**Key Principles**:
1. **JWT Custom Claims for Admin**: Admin status read from `request.auth.token.admin` (zero Firestore reads, no TOCTOU window)
2. **Field-Level Security**: Sensitive fields (`role`, `coinBalance`, `disabled`) only writable by admin or service layer
3. **Amount Validation**: Ledger entries constrained to `amount >= -10000 AND amount <= 10000`
4. **Idempotency Enforcement**: Ledger entries must have unique `refId` and match balance
5. **State Machine Enforcement**: Booking status transitions validated in rules

**Critical Rule Patterns**:

```typescript
// Admin check via JWT claim (no Firestore read)
function isAdmin() {
  return isSignedIn() && request.auth.token.admin == true;
}

// Owner wallet mutation with ledger verification
function ownerWalletMutationAllowed(userId) {
  let changed = request.resource.data.diff(resource.data).affectedKeys();
  let ledgerPath = /databases/$(database)/documents/coinLedger/$(userId)/entries/$(request.resource.data.lastLedgerEntryId);
  return changed.hasOnly(["coinBalance", "cashableBalance", "updatedAt", "lastLedgerEntryId"])
    && request.resource.data.lastLedgerEntryId is string
    && request.resource.data.coinBalance is int
    && request.resource.data.coinBalance >= 0
    && existsAfter(ledgerPath)
    && getAfter(ledgerPath).data.uid == userId
    && getAfter(ledgerPath).data.balanceAfter == request.resource.data.coinBalance
    && getAfter(ledgerPath).data.createdAt > request.time - duration.time(1, 'm');
}

// Booking status transition validation
function bookingStatusTransitionAllowed() {
  let changed = request.resource.data.diff(resource.data).affectedKeys();
  return changed.hasOnly(["status", "updatedAt", "confirmedAt", ...])
    && (
      (resource.data.status == "pending" && request.resource.data.status == "confirmed" && request.auth.uid == resource.data.proId)
      || (resource.data.status == "pending" && request.resource.data.status == "cancelled" && ...)
      || ...
    );
}
```

### Admin Safeguards

1. **Self-Targeting Prevention**: Admins cannot modify their own accounts for sensitive actions (role changes, disable, delete)
2. **Confirmation Dialogs**: Required for role escalation, bulk operations, deletions
3. **Audit Trail Mandatory**: All destructive actions logged with admin ID, target, timestamp, metadata
4. **Active Admin Guard**: Cannot demote/disable the last active admin

### Input Validation

- **Zod schemas** at service boundaries for type-safe validation
- **DOMPurify** for content sanitization (prevents XSS)
- **Firestore rules** as final gate (never trust client-side validation alone)
- **Cloudinary validation** for file uploads (size, type, dimensions)

---

## Performance Architecture

### Query Optimization

**Indexed Fields**:
- `users`: `role`, `residentVerificationStatus`, `createdAt`
- `services`: `userId`, `status`, `category`, `createdAt`
- `bookings`: `clientId`, `proId`, `status`, `createdAt`
- `coinLedger/{uid}/entries`: `type`, `createdAt`
- `messages`: `participants`, `lastMessageAt`

**Composite Indexes** (defined in `firestore.indexes.json`):
```json
{
  "collectionGroup": "services",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**Pagination Strategy**:
```typescript
// Cursor-based pagination for large result sets
export async function getAllServices(
  limit_ = 50,
  cursor?: QueryDocumentSnapshot | null
): Promise<{ data: Record<string, unknown>[]; nextCursor: QueryDocumentSnapshot | null }> {
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(limit_)];
  if (cursor) constraints.push(startAfter(cursor));
  const snap = await getDocs(query(collection(db, "services"), ...constraints));
  const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const nextCursor = snap.docs.length === limit_ ? snap.docs[snap.docs.length - 1] : null;
  return { data, nextCursor };
}
```

### Caching Strategy

**React Query Cache Durations**:
- Profiles: 5 minutes (rarely change)
- Services: 2 minutes (moderate change frequency)
- Balances: 30 seconds (frequent updates)

**Cache Invalidation**:
```typescript
// After mutations, invalidate related queries
queryClient.invalidateQueries({ queryKey: ["wallet", "balance", uid] });
queryClient.invalidateQueries({ queryKey: ["services", "user", uid] });
```

### Cloud Function Efficiency

**Rating Recalculation** (`onReviewWrite`):
- Full collection scan per review (acceptable for low volume)
- Future optimization: Incremental counter approach if p99 latency > 2s
- Currently runs server-side (no client latency)

**Daily Renewal Sweep** (`dailyRenewalSweep`):
- Runs at 02:00 IST daily
- Checks `config/platformSettings.subscription.cronEnabled` before processing
- Processes reminders (T-7, T-3, T-1) and expiry in single pass

### Build Optimization

**Vite Chunk Splitting** (`vite.config.ts`):
```typescript
rollupOptions: {
  output: {
    manualChunks: {
      'firebase-firestore': ['firebase/firestore'],
      'firebase-auth': ['firebase/auth'],
      'firebase-messaging': ['firebase/messaging'],
      'react-vendor': ['react', 'react-dom', 'react-router-dom'],
      'components': ['./src/components'],
    },
  },
}
```

**PWA Configuration**:
- Service worker: `public/sw.js` (cache name `proneighbor-v3-*`)
- Cache strategy: Network-first for HTML, cache-first for static assets
- Manifest with app shortcuts
- Install banner and splash screen components

---

## Design Trade-offs Analysis

### Trade-off 1: Firebase-Native vs Custom Backend

**Decision**: Firebase-native architecture (Firestore, Auth, Cloud Functions)

| Pros | Cons |
|------|------|
| Rapid development (no server infrastructure) | Vendor lock-in |
| Real-time capabilities out-of-the-box | Limited query flexibility (no JOINs) |
| Automatic scaling | Complex aggregations expensive |
| Integrated security rules | Cold starts for Cloud Functions |
| Built-in authentication | Blaze plan required for advanced features |

**When to Reconsider**:
- If query complexity grows beyond Firestore capabilities
- If cost exceeds custom backend at scale (>100K users)
- If multi-cloud strategy needed

**Mitigation**: Service layer abstraction allows backend swap if needed.

---

### Trade-off 2: Dual-Bucket Wallet vs Single Balance

**Decision**: Dual-bucket (cashable + promo)

| Pros | Cons |
|------|------|
| Financial compliance (only real-money withdrawable) | User confusion ("Why can't I withdraw my 500 NC?") |
| Clear audit trail | Complex balance calculations |
| Prevents bonus exploitation | More Firestore reads/writes |
| Regulatory clarity | Harder to explain to users |

**Mitigation**:
- Clear UI labeling (💳 Cashable vs 🎁 Bonus)
- Wallet overview card showing breakdown
- FAQ/tooltips explaining the difference
- Separate ledger entries for each type

**Alternative Considered**: Single balance with withdrawal restrictions → Rejected due to audit complexity.

---

### Trade-off 3: Escrow Model vs Direct Payment

**Decision**: Escrow (coins held until completion)

| Pros | Cons |
|------|------|
| Trust mechanism for strangers | Pro cash flow delay |
| Dispute resolution leverage | Complexity in refund logic |
| Platform fee collection guaranteed | User friction (coins "locked") |
| Reduces fraud risk | Requires atomic transactions |

**When to Reconsider**:
- If pro base becomes trusted (repeat professionals)
- If micro-transactions dominate (escrow overhead too high)

**Alternative Considered**: Direct payment with refund guarantee → Rejected due to higher fraud risk in anonymous marketplace.

---

### Trade-off 4: Client-Side vs Server-Side Validation

**Decision**: Hybrid approach (Zod on client, Firestore rules as final gate)

| Pros | Cons |
|------|------|
| Fast feedback for users (client-side) | Duplicate validation logic |
| Security enforced server-side (Firestore rules) | Rules can be hard to debug |
| Defense in depth | Client can still attempt invalid writes |
| Type safety with Zod | Maintenance overhead |

**Best Practice**:
- Zod schemas at service boundaries
- Firestore rules as single source of truth
- Never trust client-side validation alone

---

### Trade-off 5: Moderation Queue vs Auto-Approval

**Decision**: Manual moderation for all new services

| Pros | Cons |
|------|------|
| Quality control | Admin bottleneck |
| Fraud prevention | Delayed listing activation |
| Curated marketplace | Operational overhead |
| Brand protection | Scalability concerns |

**Future Enhancement**:
- AI-assisted moderation (image/text analysis)
- Trusted provider auto-approval after N successful bookings
- Community reporting for post-approval issues

---

### Trade-off 6: Public Profile Mirror vs Single Document

**Decision**: Dual storage (`users/{uid}` + `publicProfiles/{uid}`)

| Pros | Cons |
|------|------|
| Read performance (no auth-sensitive data) | Data duplication |
| Simplified security rules (no field masking) | Sync complexity via `mirrorPublicProfile()` |
| Faster browse queries | eventual consistency window |
| Reduced Firestore reads for public data | Storage cost increase |

**Mitigation**:
- `mirrorPublicProfile()` called on every profile update
- Transaction ensures atomicity
- Fallback to `users/{uid}` if `publicProfiles/{uid}` missing

---

### Trade-off 7: Subscription via NC vs Fiat

**Decision**: NC-only payments for subscriptions (no Razorpay)

| Pros | Cons |
|------|------|
| Simplifies subscription flow | Users must top up wallet first |
| Drives coin purchases | Friction in conversion funnel |
| No payment gateway fees | Limited to users with NC balance |
| Consistent with platform currency | Requires Blaze plan for Cloud Functions |

**When to Reconsider**:
- If conversion rate too low
- If users request direct fiat payments
- If Razorpay integration becomes seamless

---

## Integration Points

### Razorpay (Payment Gateway)

**Purpose**: Coin pack top-ups (real money → NC)

**Flow**:
```
1. Client calls createRazorpayOrder Cloud Function
2. Cloud Function creates order via Razorpay API
3. Client opens Razorpay checkout with order_id
4. User completes payment
5. Razorpay webhook fires (server-side verification)
6. Cloud Function credits coins via topUpCoins()
7. Ledger entry created (type: "topup")
```

**Security**:
- Server-side order creation (no client-side key exposure)
- Webhook signature verification
- Idempotency via paymentId

**Plan Requirement**: Blaze plan (HTTPS callables + outbound network)

**Spark Plan Fallback**: Top-ups disabled (fail-closed) to prevent insecure client-side crediting.

---

### Cloudinary (Image/Video Uploads)

**Purpose**: Profile photos, residency proofs, booking attachments, chat attachments

**Configuration**:
```typescript
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
```

**Upload Folders**:
- `ProNeighbor/profiles` — Profile photos
- `ProNeighbor/residency-proofs` — Residency verification documents
- `ProNeighbor/bookings` — Booking attachments
- `ProNeighbor/messages/{conversationId}` — Chat attachments

**Validation** (`src/utils/cloudinary.ts`):
- File size limits (profile: 5MB, proof: 10MB, attachment: 20MB)
- File type validation (images, PDFs)
- Dimension validation for images

**PDF Handling**: Residency proofs uploaded as PDFs converted to image previews via Cloudinary's `pg_1` transformation.

---

### Sentry (Error Tracking & Monitoring)

**Purpose**: Error tracking, performance monitoring, release health

**Configuration** (`src/lib/sentry.ts`):
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

**Usage**:
```typescript
// Capture errors with context
captureError(error, { operation: "topup_coins", uid });

// Set user context
setSentryUser(uid);
```

**Key Metrics**:
- Error rate by feature
- Page load times
- API latency
- Web Vitals (LCP, FID, CLS)

---

### Firebase Cloud Messaging (FCM)

**Purpose**: Push notifications for booking updates, messages, subscription reminders

**Flow**:
```
1. Client requests notification permission
2. FCM token retrieved via getToken()
3. Token saved to users/{uid}.fcmToken
4. Cloud Function sends notification via FCM API
5. Service worker handles background messages
6. Foreground messages shown via onMessage listener
```

**Service Worker**: Unified `/sw.js` handles both PWA caching and FCM background messages (avoiding conflicts from multiple SWs).

**VAPID Key**: Required for web push (configured in `VITE_FCM_VAPID_KEY`).

---

## Testing Strategy

### Unit/Integration Tests (Vitest)

**Coverage Thresholds**:
- 80% statements/lines/functions
- 60% branches

**Test Structure**:
```
src/
├── services/
│   ├── coinService.test.ts
│   ├── activityService.test.ts
│   ├── auditService.test.ts
│   ├── razorpayService.test.ts
│   ├── supportService.test.ts
│   └── __tests__/
│       ├── notificationService.test.ts
│       ├── serviceService.test.ts
│       ├── subscriptionService.test.ts
│       └── supportService.test.ts
├── utils/
│   ├── account.test.ts
│   ├── booking.test.ts
│   ├── browse.test.ts
│   ├── rating.test.ts
│   ├── serviceSelection.test.ts
│   └── time.test.ts
└── lib/
    └── validation.test.ts
```

**Mocking Strategy**:
- MSW (Mock Service Worker) for Firestore/API calls
- Vitest mocks for Firebase SDK
- Test fixtures for common data structures

**Critical Test Coverage**:
- ✅ Coin top-up flow
- ✅ Escrow hold/release/refund
- ✅ Payout request with sentinel lock
- ✅ Booking state transitions
- ✅ Referral split flow
- ✅ Subscription purchase
- ✅ Input validation (Zod schemas)

**Coverage Gaps**:
- ⚠️ Admin wallet adjustment flows
- ⚠️ Concurrent payout race conditions (stress test)
- ⚠️ Message service end-to-end
- ❌ Notification delivery
- ❌ Admin user deletion cascade

---

### E2E Tests (Playwright)

**Configuration**:
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

**Test Suites**:
- `auth.spec.ts` — Login, signup, forgot password
- `booking-flow.spec.ts` — Complete booking lifecycle
- `browse.spec.ts` — Service discovery and filtering
- `complete-booking-flow.spec.ts` — End-to-end booking with payment
- `login-flow.spec.ts` — Authentication flows
- `signup-flow.spec.ts` — Registration with referral

**Test User Seeding**:
```bash
npm run seed:test-users
```

**Debug Tools**:
- Inspector: `npm run test:e2e:ui`
- Trace recording: `npm run test:e2e:trace`
- Headed mode: `npm run test:e2e:headed`

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE HOSTING                          │
│  ├─ dist/ (production build)                                │
│  │   ├─ index.html (no-cache)                               │
│  │   ├─ sw.js (no-cache)                                    │
│  │   ├─ manifest.json (no-cache)                            │
│  │   └─ assets/ (immutable, 1yr cache)                      │
│  │       ├─ *.js                                            │
│  │       └─ *.css                                           │
│  └─ Firebase CLI deployment                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE FIRESTORE                        │
│  ├─ Security Rules: firestore.rules                         │
│  ├─ Indexes: firestore.indexes.json                         │
│  └─ Collections: 25+ (see Data Layer section)               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 FIREBASE CLOUD FUNCTIONS                     │
│  ├─ onReviewWrite (Spark-compatible)                        │
│  ├─ subscribeWithNCCallable (Blaze-required)                │
│  ├─ activateTrialCallable (Blaze-required)                  │
│  ├─ dailyRenewalSweep (Blaze-required, scheduled)           │
│  └─ adminSubscriptionAction (Blaze-required)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   FIREBASE STORAGE                           │
│  ├─ Profile photos                                          │
│  ├─ Residency proofs                                        │
│  └─ Booking attachments                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                          │
│  ├─ Razorpay (payments) — Blaze plan required               │
│  ├─ Cloudinary (image uploads)                              │
│  └─ Sentry (error tracking)                                 │
└─────────────────────────────────────────────────────────────┘
```

**Deployment Commands**:
```bash
# Build production bundle
npm run build

# Deploy to Firebase
firebase deploy

# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions

# Deploy only Firestore rules
firebase deploy --only firestore:rules
```

---

## Evolution Roadmap

### Phase 1: Stability & Coverage (Current)
- [ ] Increase test coverage to 80%+ for critical paths
- [ ] Fix timezone bug in rebook date picker
- [ ] Resolve platform fee mismatch (10% vs 15%)
- [ ] Add E2E tests for admin flows
- [ ] Implement incremental rating counter (replace full collection scan)

### Phase 2: Scale & Automation (Next Quarter)
- [ ] Add subscription auto-renewal
- [ ] Enable AI-assisted service moderation
- [ ] Optimize Firestore indexes for complex queries
- [ ] Implement real-time booking status updates (onSnapshot)
- [ ] Add batch operations for admin (bulk approve/reject)

### Phase 3: Growth & Engagement (6 Months)
- [ ] Launch Phase 2 earning mechanisms (group sessions, on-demand)
- [ ] Implement loyalty tiers (Bronze/Silver/Gold/Diamond)
- [ ] Add coin gifting between users
- [ ] Build analytics dashboard for admins
- [ ] Implement advanced search (full-text, geospatial)

### Phase 4: Platform Expansion (12 Months)
- [ ] Multi-society support (cross-community bookings)
- [ ] Corporate partnerships (bulk coin purchases)
- [ ] API for third-party integrations
- [ ] Native mobile apps (React Native)
- [ ] Internationalization (i18n) for multiple languages

---

## Development Workflow

```bash
# Start development server
npm run dev                # Vite dev server on port 5173

# Build for production
npm run build              # TypeScript check + Vite production build

# Run tests
npm run test               # Vitest with coverage
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report

# Run E2E tests
npm run test:e2e           # Playwright end-to-end tests
npm run test:e2e:ui        # Playwright UI mode
npm run test:e2e:headed    # Headed browser mode
npm run test:e2e:debug     # Debug mode
npm run test:e2e:trace     # Trace recording

# Seed test data
npm run seed:test-users    # Seed test users (requires Firebase service account)

# Deploy
firebase deploy            # Deploy to Firebase Hosting + Functions
```

---

## Known Technical Debt

1. **Timezone Bug**: IST off-by-1 in rebook date picker
2. **Platform Fee Mismatch**: Default 10% vs documented 15% (fixed in recent code, legacy bookings may have old rate)
3. **Coverage Gaps**: AdminPanel pages, message service, notification service not fully tested
4. **Legacy Field Support**: Dual field names (`clientId`/`clientUid`, `proId`/`proUid`) maintained for backward compatibility
5. **Rating Recalculation**: Full collection scan per review (scales poorly beyond 10K reviews per pro)
6. **Subscription Auto-Renewal**: Not yet implemented (manual renewal only)
7. **Error Boundary Coverage**: Not all routes wrapped in ErrorBoundary
8. **Firestore Indexes**: Some complex queries may require additional composite indexes

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
| **FCM** | Firebase Cloud Messaging (push notifications) |
| **RBAC** | Role-Based Access Control |
| **Zod** | TypeScript-first schema validation library |
| **TanStack Query** | Data fetching and caching library (formerly React Query) |
| **Vite** | Fast build tool and dev server |
| **MSW** | Mock Service Worker (API mocking for tests) |

---

## References

- **AGENTS.md**: Developer guidelines and conventions
- **BUGS.md**: Active issue tracking
- **AUDIT_REPORT.md**: Comprehensive code audit findings
- **firestore.rules**: Security rules (single source of truth for access control)
- **functions/src/**: Cloud Functions implementation
- **src/services/**: Service layer implementations
- **docs/order-flow.md**: Detailed booking lifecycle documentation
- **docs/strategies/options-engine.md**: Subscription engine documentation
- **docs/AGoT-playbook.md**: Reasoning framework and decision guides
- **docs/Functional-Specification.md**: Complete feature specification
- **docs/USER-GUIDE.md**: End-user documentation
