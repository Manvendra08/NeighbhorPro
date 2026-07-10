# ProNeighbor Order Flow

> **Version**: 2.1 | **Last Updated**: June 29, 2026 | **Status**: Production-Ready

---

## Executive Summary

The booking system manages the complete lifecycle from service discovery through completion, with escrow-based coin handling and dual-party state transitions. This document details every phase of the order flow, including error handling, edge cases, and integration points.

### Key Principles
1. **Escrow-First**: Coins held until service completion (trust mechanism)
2. **Atomic Operations**: All financial mutations use Firestore transactions
3. **Idempotency**: Network retries safe via unique ledger entry IDs
4. **State Machine**: Strict booking status transitions enforced
5. **Dual-Party Authorization**: Only specific roles can trigger specific transitions

---

## Booking Lifecycle Overview

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Discovery  │─────▶│  Selection  │─────▶│   Booking   │─────▶│   Escrow    │
│  (Browse)   │      │  (ProDetail)│      │  Creation   │      │    Hold     │
└─────────────┘      └─────────────┘      └─────────────┘      └──────┬──────┘
                                                                       │
                                    ┌──────────────────────────────────┘
                                    │
                                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Review    │◀─────│  Completion │◀─────│ Confirmation│◀─────│  Service    │
│  (Client)   │      │    (Pro)    │      │    (Pro)    │      │  Delivery   │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
       │
       │ OR
       ▼
┌─────────────┐
│ Cancellation│
│  (Either)   │
└─────────────┘
```

### State Machine

```
                    ┌──────────────┐
                    │   PENDING    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │CONFIRMED │  │CANCELLED │  │CANCELLED │
       │  (Pro)   │  │(Client/  │  │(Client/  │
       │          │  │  Pro)    │  │  Pro)    │
       └────┬─────┘  └──────────┘  └──────────┘
            │
            │
            ▼
       ┌──────────┐
       │COMPLETED │
       │  (Pro)   │
       └────┬─────┘
            │
            ▼
       ┌──────────┐
       │ REVIEWED │
       │(Client)  │
       └──────────┘
```

### Transition Rules

| From | To | Authorized By | Validation | Side Effects |
|------|----|---------------|------------|--------------|
| `pending` | `confirmed` | Pro only | Must be pending status | Notify client |
| `pending` | `cancelled` | Client or Pro | Refund escrow if held | Refund coins, notify other party |
| `confirmed` | `completed` | Pro only | Must be confirmed status | Release escrow to pro (minus 15% fee) |
| `confirmed` | `cancelled` | Client or Pro | Refund escrow if held | Refund coins, notify other party |
| `completed` | `reviewed` | Client only | Must be completed status | Trigger review flow, earn 20 NC |

---

## Phase 1: Service Discovery & Selection

### Browse Pros (`src/pages/BrowsePros.tsx`)

**User Action**: Resident searches for services by category, locality, or keyword

**Data Flow**:
```typescript
// React Query fetches services with caching
useAllServicesQuery(limit = 50) 
  → getAllServices() 
    → Firestore query: collection("services")
      .where("status", "==", "approved")
      .orderBy("createdAt", "desc")
```

**Key Filters**:
- Category (from `config/platformSettings.serviceCategories`)
- Locality/Society
- Price range
- Verification status
- Subscription status (Business category requires active subscription)

**Service Card Display**:
- Provider name, photo, verification badge
- Rating and review count (aggregated via Cloud Function `onReviewWrite`)
- Hourly rate or "Free consultation"
- Category badge
- Subscription indicator (for Business categories)

**Performance Considerations**:
- Cursor-based pagination (20 items per page)
- Composite indexes on `status + createdAt`
- React Query cache: 2 minutes stale time
- Fallback query if filtered results empty (broadens search)

### Professional Detail (`src/pages/ProDetail.tsx`)

**User Action**: Resident views detailed profile of a professional

**Data Loaded**:
```typescript
const [profile, bookings, reviews, availability] = await Promise.all([
  getPublicProfile(proId),
  getBookingsForProOnDate(proId, selectedDate),
  getReviewsForUser(proId),
  getProAvailability(proId),
]);
```

**Key Features**:
- Rating distribution (5-star histogram)
- Availability calendar (day-by-day slots)
- Recent bookings (to check conflicts)
- Reviews list with pagination
- Contact button (opens chat if booking exists)
- Book Now button (navigates to BookingFlow)

**Subscription Check**:
```typescript
// Business category services require active subscription
if (BUSINESS_CATEGORIES.includes(service.category)) {
  const sub = await getSubscription(service.userId);
  if (!isSubActive(sub)) {
    // Hide or mark as unavailable
    showSubscriptionRequiredBanner();
  }
}
```

---

## Phase 2: Booking Creation

### Booking Flow (`src/pages/BookingFlow.tsx`)

#### Step 1: Service Details Review
- Display service description, duration, pricing
- Show provider profile (skills, bio, rating)
- Check availability via `getBookingsForProOnDate()`

#### Step 2: Date/Time Selection
- Calendar picker with available slots
- Conflict detection: Query existing bookings for pro on selected date
- Timezone handling: Store UTC timestamps, display in user's local timezone

**Availability Check**:
```typescript
const existingBookings = await getBookingsForProOnDate(proId, selectedDate);
const bookedSlots = existingBookings.map(b => b.timeSlot);
const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));
```

#### Step 3: Payment Confirmation
- Calculate total coins required (service price + platform fee)
- Check user balance via `useCoinBalanceQuery()`
- Display breakdown: Base price, platform fee (15%), total

**Fee Calculation**:
```typescript
const basePrice = service.price;
const platformFee = Math.round(basePrice * 0.15); // 15% default
const totalCoins = basePrice + platformFee;

// OR use stored commission rate if available
const effectiveRate = booking.commissionRate / 100 || 0.15;
const platformFee = Math.round(basePrice * effectiveRate);
```

#### Step 4: Booking Submission

**Critical Path**:
```typescript
createBooking({
  clientId: user.uid,
  proId: selectedPro.uid,
  serviceName: service.title,
  amount: service.price,
  escrowCoins: calculatedTotal,
  date: selectedDate,
  notes: userNotes
})
```

**Transaction Logic** (`bookingService.ts`):
```typescript
await runTransaction(db, async tx => {
  if (escrowCoins > 0) {
    // 1. Check user balance
    const userSnap = await tx.get(doc(db, "users", clientId));
    const balance = userSnap.data()?.coinBalance ?? 0;
    if (balance < escrowCoins) throw new Error("INSUFFICIENT_BALANCE");
    
    // 2. Deduct coins from user
    const newBal = balance - escrowCoins;
    tx.update(userRef, { 
      coinBalance: newBal, 
      cashableBalance: newBal, // escrow comes from cashable
      updatedAt: serverTimestamp(),
      lastLedgerEntryId: ledgerEntryId
    });
    
    // 3. Create booking with escrow held
    tx.set(bookingRef, {
      clientId,
      proId,
      serviceName,
      amount: basePrice,
      escrowCoins,
      escrowStatus: "held",
      coinsPaid: true,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // 4. Write ledger entry (idempotent key)
    const ledgerEntryId = `${bookingRef.id}_create_hold_${clientId}`;
    tx.set(doc(db, "coinLedger", clientId, "entries", ledgerEntryId), {
      uid: clientId,
      type: "booking_escrow",
      amount: -escrowCoins,
      balanceAfter: newBal,
      description: `Payment held: ${serviceName}`,
      refId: bookingRef.id,
      createdAt: serverTimestamp()
    });
  } else {
    // Free booking — no escrow
    tx.set(bookingRef, { 
      status: "pending", 
      escrowStatus: "none",
      coinsPaid: false,
      createdAt: serverTimestamp()
    });
  }
});
```

**Post-Creation Actions**:
- Activity log: `logActivity(clientId, "booking.created", ...)`
- Notification to pro: New booking request
- Redirect to `/bookings` with success toast
- Invalidate React Query cache for bookings

---

## Phase 3: Booking State Transitions

### Confirmation (`updateBookingStatus`)

**Pro Action**: Accepts booking request

**Sequence Diagram**:
```
Client                Pro                   Firestore
  │                    │                       │
  │  Create Booking    │                       │
  │───────────────────▶│                       │
  │                    │  Check notifications  │
  │                    │───────────────────────▶│
  │                    │◀───────────────────────│
  │                    │                       │
  │                    │  Confirm Booking      │
  │                    │───────────────────────▶│
  │                    │                       │
  │                    │                       │──┐
  │                    │                       │  │ Validate:
  │                    │                       │  │ - status == "pending"
  │                    │                       │  │ - caller == proId
  │                    │                       │◀─┘
  │                    │                       │
  │                    │                       │──┐
  │                    │                       │  │ Update:
  │                    │                       │  │ - status = "confirmed"
  │                    │                       │  │ - confirmedAt = now
  │                    │                       │  │ - confirmedBy = proId
  │                    │                       │◀─┘
  │                    │                       │
  │  Notify: Confirmed │                       │
  │◀───────────────────│                       │
  │                    │                       │
```

**Implementation**:
```typescript
updateBookingStatus(bookingId, "confirmed", proUid)
  → Validates: currentUserId === proId
  → Updates: status = "confirmed", confirmedAt = now, confirmedBy = proId
  → Logs activity: "booking.confirmed"
  → Notifies client: Booking confirmed
```

**Firestore Rule Validation**:
```typescript
// Only pro can confirm, and only from pending status
(resource.data.status == "pending" && request.resource.data.status == "confirmed" && request.auth.uid == resource.data.proId)
```

---

### Cancellation with Refund (`cancelBookingAndRefund`)

**Atomic Operation** (prevents partial failure):

**Sequence Diagram**:
```
Client/Pro            Firestore                 Ledger
  │                       │                        │
  │  Cancel Booking       │                        │
  │──────────────────────▶│                        │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Read booking        │
  │                       │  │ Check status        │
  │                       │◀─┘                     │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Validate:           │
  │                       │  │ - status != final   │
  │                       │  │ - caller is party   │
  │                       │◀─┘                     │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Update booking:     │
  │                       │  │ - status = cancelled│
  │                       │  │ - cancelledBy       │
  │                       │◀─┘                     │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ If escrow held:     │
  │                       │  │ - Refund coins      │
  │                       │  │ - Update balances   │
  │                       │  │ - Write ledger      │
  │                       │◀─┘────────────────────▶│
  │                       │                        │
  │  Success              │                        │
  │◀──────────────────────│                        │
  │                       │                        │
```

**Transaction Logic**:
```typescript
await runTransaction(db, async tx => {
  // 1. Read booking
  const bookingSnap = await tx.get(bookingRef);
  const data = bookingSnap.data();
  
  // 2. Validate state
  if (data.status === "cancelled" || data.status === "completed") {
    throw new Error("ALREADY_FINALIZED");
  }
  
  // 3. Mark as cancelled
  tx.update(bookingRef, {
    status: "cancelled",
    cancelledBy: uid,
    cancelledAt: serverTimestamp()
  });
  
  // 4. Refund escrow if held
  if (escrowCoins > 0 && escrowStatus === "held") {
    const clientRef = doc(db, "users", clientUid);
    const clientSnap = await tx.get(clientRef);
    const newBal = clientSnap.data().coinBalance + escrowCoins;
    const newCashable = clientSnap.data().cashableBalance + escrowCoins;
    
    tx.update(clientRef, { 
      coinBalance: newBal, 
      cashableBalance: newCashable,
      updatedAt: serverTimestamp(),
      lastLedgerEntryId: ledgerEntryId
    });
    
    tx.update(bookingRef, { 
      escrowStatus: "refunded", 
      coinsPaid: false 
    });
    
    // Ledger entry for refund
    tx.set(ledgerRef, {
      uid: clientUid,
      type: "booking_refund",
      amount: escrowCoins,
      balanceAfter: newBal,
      description: `Refund (Cancellation): ${serviceName}`,
      refId: bookingId,
      createdAt: serverTimestamp()
    });
  }
});
```

**Activity Logging**:
```typescript
// Client cancels
await logActivity(uid, "booking.cancelled", 
  `Cancelled booking: ${serviceName} with ${proName}`, {
    bookingId,
    role: "client",
    escrowRefunded: escrowCoins
  });

// Pro declines
await logActivity(uid, "booking.cancelled", 
  `Declined booking: ${serviceName} from ${clientName}`, {
    bookingId,
    role: "pro",
    escrowRefunded: escrowCoins
  });
```

**Firestore Rule Validation**:
```typescript
// Both client and pro can cancel from pending or confirmed
(resource.data.status == "pending" && request.resource.data.status == "cancelled" && 
  (request.auth.uid == resource.data.clientId || request.auth.uid == resource.data.proId))
||
(resource.data.status == "confirmed" && request.resource.data.status == "cancelled" && 
  (request.auth.uid == resource.data.clientId || request.auth.uid == resource.data.proId))
```

---

## Phase 4: Completion & Escrow Release

### Pro Completes Booking

**Action**: Pro marks booking as completed after service delivery

**Sequence Diagram**:
```
Pro                   Firestore                 Client
  │                       │                        │
  │  Complete Booking     │                        │
  │──────────────────────▶│                        │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Idempotency check   │
  │                       │  │ (ledger entry)      │
  │                       │◀─┘                     │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Read booking        │
  │                       │  │ Check escrowStatus  │
  │                       │◀─┘                     │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Guard against       │
  │                       │  │ re-completion       │
  │                       │  │ (released/refunded) │
  │                       │◀─┘                     │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Calculate fees:     │
  │                       │  │ - platformFee 15%   │
  │                       │  │ - proEarning 85%    │
  │                       │◀─┘                     │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Credit pro:         │
  │                       │  │ - coinBalance       │
  │                       │  │ - cashableBalance   │
  │                       │◀─┘                     │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Update booking:     │
  │                       │  │ - status = completed│
  │                       │  │ - escrowStatus =    │
  │                       │  │   released          │
  │                       │  │ - platformFee       │
  │                       │  │ - proEarning        │
  │                       │◀─┘                     │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Write ledger entry  │
  │                       │  │ (booking_escrow_    │
  │                       │  │  release)           │
  │                       │◀─┘                     │
  │                       │                        │
  │  Success              │                        │
  │◀──────────────────────│                        │
  │                       │                        │
  │                       │  Notify: Completed     │
  │                       │───────────────────────▶│
  │                       │                        │
```

**Transaction Logic** (`coinService.ts`):
```typescript
await runTransaction(db, async tx => {
  // 1. Idempotency check
  const ledgerEntryId = `${bookingId}_release_${proUid}`;
  const ledgerEntryRef = doc(collection(db, "coinLedger", proUid, "entries"), ledgerEntryId);
  const existingEntry = await tx.get(ledgerEntryRef);
  if (existingEntry.exists()) return; // Already processed
  
  // 2. Read booking
  const bookingSnap = await tx.get(bookingRef);
  const data = bookingSnap.data();
  
  // 3. Guard against re-completion
  if (data.escrowStatus === "released" || data.status === "reviewed") return;
  if (data.escrowStatus === "refunded") return; // Cancelled booking
  
  const escrowCoins = data.escrowCoins ?? 0;
  
  // 4. Handle zero-escrow bookings
  if (escrowCoins === 0) {
    tx.update(bookingRef, { 
      status: "completed", 
      completedAt: serverTimestamp(),
      completedBy: proUid 
    });
    return;
  }
  
  // 5. Calculate platform fee and pro earnings
  const storedCommissionRate = Number(data.commissionRate);
  const storedPlatformFee = Number(data.platformFee);
  const storedProEarning = Number(data.proEarning);
  
  const effectiveRate = Number.isFinite(storedCommissionRate) && storedCommissionRate >= 0
    ? storedCommissionRate / 100
    : platformFeePct; // default 0.15
  
  const platformFee = Number.isFinite(storedPlatformFee) && storedPlatformFee >= 0
    ? Math.min(escrowCoins, Math.round(storedPlatformFee))
    : Math.round(escrowCoins * effectiveRate);
  
  const proEarning = Number.isFinite(storedProEarning) && storedProEarning >= 0
    ? Math.min(escrowCoins, Math.round(storedProEarning))
    : Math.max(0, escrowCoins - platformFee);
  
  // 6. Credit pro (both cashable and total balance)
  const proRef = doc(db, "users", proUid);
  const proSnap = await tx.get(proRef);
  const newProBal = proSnap.data().coinBalance + proEarning;
  const newProCashable = proSnap.data().cashableBalance + proEarning;
  
  tx.update(proRef, { 
    coinBalance: newProBal, 
    cashableBalance: newProCashable,
    updatedAt: serverTimestamp(),
    lastLedgerEntryId: ledgerEntryId
  });
  
  // 7. Update booking
  tx.update(bookingRef, {
    status: "completed",
    escrowStatus: "released",
    platformFee,
    proEarning,
    paidInCoins: escrowCoins,
    coinsPaid: true,
    completedAt: serverTimestamp(),
    completedBy: proUid
  });
  
  // 8. Ledger entry for pro earning
  tx.set(ledgerEntryRef, {
    uid: proUid,
    type: "booking_escrow_release",
    amount: proEarning,
    balanceAfter: newProBal,
    description: `Earned: ${serviceName} (platform fee deducted)`,
    refId: bookingId,
    createdAt: serverTimestamp()
  });
});

// 9. Log activity (outside transaction)
await logActivity(proUid, "booking.completed", 
  `Completed booking: ${serviceName} for ${clientName}`, {
    bookingId,
    role: "pro",
    escrowReleased: escrowCoins
  });
```

**Financial Split Example**:
```
Escrow: 1000 NC
Platform Fee (15%): 150 NC → Platform revenue
Pro Earning: 850 NC → Credited to pro's cashableBalance
```

**Firestore Rule Validation**:
```typescript
// Only pro can complete, and only from confirmed status
(resource.data.status == "confirmed" && request.resource.data.status == "completed" && request.auth.uid == resource.data.proId)
```

---

## Phase 5: Review & Closure

### Client Marks as Reviewed

**Action**: Client confirms satisfaction and optionally writes review

**Sequence Diagram**:
```
Client                Firestore              Cloud Function
  │                       │                        │
  │  Mark as Reviewed     │                        │
  │──────────────────────▶│                        │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Validate:           │
  │                       │  │ - status == completed│
  │                       │  │ - caller == clientId│
  │                       │◀─┘                     │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Update booking:     │
  │                       │  │ - status = reviewed │
  │                       │  │ - reviewedAt = now  │
  │                       │  │ - reviewedBy        │
  │                       │◀─┘                     │
  │                       │                        │
  │  Submit Review        │                        │
  │──────────────────────▶│                        │
  │                       │                        │
  │                       │──┐                     │
  │                       │  │ Create review doc   │
  │                       │  │ (id: bookingId_     │
  │                       │  │      clientId)      │
  │                       │◀─┘                     │
  │                       │                        │
  │                       │  Trigger onReviewWrite │
  │                       │───────────────────────▶│
  │                       │                        │
  │                       │                        │──┐
  │                       │                        │  │ Fetch all reviews
  │                       │                        │  │ for pro
  │                       │                        │◀─┘
  │                       │                        │
  │                       │                        │──┐
  │                       │                        │  │ Calculate average
  │                       │                        │  │ rating
  │                       │                        │◀─┘
  │                       │                        │
  │                       │                        │──┐
  │                       │                        │  │ Update users/     │
  │                       │                        │  │ publicProfiles    │
  │                       │                        │◀─┘
  │                       │                        │
  │  Earn 20 NC           │                        │
  │◀──────────────────────│                        │
  │                       │                        │
```

**Implementation**:
```typescript
updateBookingStatus(bookingId, "reviewed", clientUid)
  → Validates: currentUserId === clientId
  → Updates: status = "reviewed", reviewedAt = now, reviewedBy = clientId
  → Triggers: earnCoins(clientUid, "earn_review") if review submitted
  → Cloud Function triggers rating recalculation
```

**Review Submission** (`reviewService.ts`):
```typescript
addReview({
  bookingId,
  proId,
  clientId,
  rating: 1-5,
  comment: string,
  photos?: string[]
})
  → Creates review document (id: `${bookingId}_${clientId}`)
  → Earns client 20 NC (promo balance)
  → Cloud Function triggers rating recalculation
```

**Cloud Function Aggregation** (`functions/src/index.ts`):
```typescript
export const onReviewWrite = functions.firestore
  .document('reviews/{reviewId}')
  .onWrite(async (change) => {
    const proId = change.after.data()?.proId;
    
    // Fetch all reviews for pro
    const snap = await db.collection('reviews')
      .where('proId', '==', proId)
      .get();
    
    // Calculate average
    const ratings = snap.docs.map(d => Number(d.data().rating));
    const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
    
    // Update both user doc and public profile
    await Promise.all([
      db.doc(`users/${proId}`).update({ 
        rating: Math.round(avg * 10) / 10,
        reviewCount: snap.size 
      }),
      db.doc(`publicProfiles/${proId}`).set({ 
        rating: Math.round(avg * 10) / 10,
        reviewCount: snap.size 
      }, { merge: true })
    ]);
  });
```

**Firestore Rule Validation**:
```typescript
// Only client can review, and only from completed status
(resource.data.status == "completed" && request.resource.data.status == "reviewed" && request.auth.uid == resource.data.clientId)

// Review creation rules
allow create: if isSignedIn()
  && request.resource.data.bookingId is string
  && request.resource.data.proId is string
  && request.resource.data.clientId is string
  && request.resource.data.rating is int
  && request.resource.data.rating >= 1
  && request.resource.data.rating <= 5
  && request.resource.data.comment is string
  && request.resource.data.comment.size() > 0
  && request.resource.data.comment.size() <= 1000
  && request.resource.data.clientId == request.auth.uid
  && reviewId == request.resource.data.bookingId + '_' + request.auth.uid
  && exists(/databases/$(database)/documents/bookings/$(request.resource.data.bookingId))
  && bookingClientId(request.resource.data.bookingId) == request.auth.uid
  && bookingProId(request.resource.data.bookingId) == request.resource.data.proId
  && get(/databases/$(database)/documents/bookings/$(request.resource.data.bookingId)).data.status in ['completed', 'reviewed'];
```

---

## Edge Cases & Error Handling

### Insufficient Balance

**Detection**: Pre-transaction balance check in `createBooking()`

**User Message**: "Insufficient NeighbourCoins. Top up your wallet to proceed."

**Recovery**: Redirect to `/wallet?tab=buy`

**Implementation**:
```typescript
if (balance < escrowCoins) {
  throw new Error("INSUFFICIENT_BALANCE");
}
```

---

### Double-Booking Prevention

**Mechanism**: Availability check before booking creation

**Query**: `getBookingsForProOnDate(proId, date)` returns conflicting bookings

**UI**: Gray out unavailable time slots

**Implementation**:
```typescript
const existingBookings = await getBookingsForProOnDate(proId, selectedDate);
const bookedSlots = existingBookings.map(b => b.timeSlot);
const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));
```

**Race Condition**: Two clients try to book same slot simultaneously
- **Solution**: Firestore transaction ensures only one succeeds
- **Fallback**: Second client sees "Slot no longer available" error

---

### Concurrent Payout Requests

**Problem**: User submits two payout requests simultaneously

**Solution**: Sentinel document pattern in `payoutLock/{uid}`

**Implementation**:
```typescript
const sentinelRef = doc(db, "payoutLock", uid);
const sentinelSnap = await tx.get(sentinelRef);
if (sentinelSnap.exists() && sentinelSnap.data()?.status === "pending") {
  throw new Error("DUPLICATE_PAYOUT");
}
tx.set(sentinelRef, { uid, status: "pending", payoutId: ... });
```

**Why This Works**:
- `tx.get()` is part of Firestore's transaction read set
- Concurrent transactions reading same doc will conflict
- Only one transaction succeeds, others retry/fail

---

### Network Retry Idempotency

**Problem**: User clicks "Pay" twice due to slow network

**Solution**: Ledger entry `refId` uniqueness check

**Implementation**:
```typescript
const ledgerEntryId = `${paymentId}_topup`;
const existingPurchase = await tx.get(doc(db, "coinPurchases", paymentId));
if (existingPurchase.exists()) return; // Skip duplicate
tx.set(ledgerRef, { type: "topup", amount: coins, refId: paymentId });
```

**Key**: Ledger entry ID is deterministic based on booking/payment ID

---

### Zero-Escrow Bookings

**Scenario**: Free consultation or promotional booking

**Handling**: Skip escrow logic, direct status transition

**Guard**: Prevent re-completion of refunded bookings

**Implementation**:
```typescript
if (escrowCoins === 0) {
  tx.update(bookingRef, { 
    status: "completed", 
    completedAt: serverTimestamp(),
    completedBy: proUid 
  });
  return;
}

// Guard against re-completion
if (data.escrowStatus === "released" || data.escrowStatus === "refunded") return;
```

---

### Partial Transaction Failure

**Problem**: Transaction succeeds but post-transaction action fails (e.g., activity log)

**Solution**: Post-transaction actions are non-critical and can fail silently

**Implementation**:
```typescript
await runTransaction(db, async tx => {
  // Critical: booking + ledger + balance updates
});

// Non-critical: activity log (can fail without rollback)
await logActivity(uid, "booking.completed", ...).catch(err => {
  captureError(err, { operation: "log_activity" });
});
```

---

### Stale Data in UI

**Problem**: User sees outdated booking status

**Solution**: React Query invalidation after mutations

**Implementation**:
```typescript
await updateBookingStatus(bookingId, "confirmed", proUid);
queryClient.invalidateQueries({ queryKey: ["bookings", bookingId] });
queryClient.invalidateQueries({ queryKey: ["bookings", "user", uid] });
```

**Real-Time Alternative**: Use `onSnapshot` for critical bookings
```typescript
const unsubscribe = onSnapshot(doc(db, "bookings", bookingId), snap => {
  setBooking(snap.data());
});
```

---

### Admin Intervention

**Scenario**: Admin needs to manually resolve a booking dispute

**Actions Available**:
1. Force-cancel booking with refund
2. Force-complete booking and release escrow
3. Adjust coins manually (credit/debit)

**Implementation**:
```typescript
// Admin force-cancel
await cancelBookingAndRefund(clientUid, bookingId, "client");

// Admin manual credit
await adminAdjustCoins(uid, amount, reason, adminUid, idempotencyKey);
```

**Audit Trail**: All admin actions logged to `auditLogs` collection

---

## Booking Data Model

### Booking Document Structure

```typescript
interface Booking {
  id: string;
  clientId: string;        // Legacy field (use clientUid)
  clientUid: string;       // Current field
  proId: string;           // Legacy field (use proUid)
  proUid: string;          // Current field
  serviceName: string;
  serviceId?: string;
  serviceCategory?: string;
  amount: number;          // Base price
  escrowCoins: number;     // Total held (includes platform fee)
  escrowStatus: "none" | "held" | "released" | "refunded";
  coinsPaid: boolean;
  paidInCoins?: number;    // Actual coins paid (may differ from escrowCoins)
  status: "pending" | "confirmed" | "completed" | "reviewed" | "cancelled";
  date: string;            // ISO date string (YYYY-MM-DD)
  timeSlot?: string;       // e.g., "10:00 AM - 11:00 AM"
  notes?: string;          // Client notes (max 500 chars)
  attachmentUrl?: string;  // Optional proof of service
  attachmentName?: string;
  attachmentType?: string;
  platformFee?: number;    // Calculated on release (15% default)
  proEarning?: number;     // Calculated on release (85% default)
  commissionRate?: number; // Stored at booking time (percentage * 100)
  confirmedAt?: Timestamp;
  confirmedBy?: string;
  completedAt?: Timestamp;
  completedBy?: string;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
  declinedAt?: Timestamp;
  declinedBy?: string;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  cancellationComment?: string;
  cancellationCommentBy?: string;
  cancellationCommentRole?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Ledger Entry Structure

```typescript
interface LedgerEntry {
  id: string;              // Deterministic ID for idempotency
  uid: string;             // User ID
  type: LedgerType;        // e.g., "booking_escrow", "booking_refund"
  amount: number;          // Positive (credit) or negative (debit)
  balanceAfter: number;    // Balance after this transaction
  description: string;     // Human-readable description
  refId?: string;          // Reference ID (bookingId, paymentId, etc.)
  createdAt: Timestamp;
}

type LedgerType =
  | "topup" | "booking_debit" | "booking_refund" | "booking_escrow"
  | "booking_escrow_release" | "payout" | "payout_cancelled"
  | "earn_review" | "earn_referral" | "earn_free_consult" | "earn_profile"
  | "earn_milestone" | "earn_groupsession" | "earn_ondemand" | "earn_signup_bonus"
  | "admin_credit" | "admin_debit" | "subscription_debit";
```

---

## Integration Points

### Notifications

**Trigger Points**:
- **New Booking**: Notify pro via `notifications` collection
- **Booking Confirmed**: Notify client
- **Booking Completed**: Notify client to review
- **Booking Cancelled**: Notify other party

**Implementation**:
```typescript
await db.collection("notifications").add({
  uid: proUid,
  kind: "booking",
  title: "New Booking Request",
  body: `${clientName} booked ${serviceName}`,
  actionUrl: `/bookings/${bookingId}`,
  read: false,
  createdAt: serverTimestamp()
});
```

**Push Notifications**: FCM sends push if user has `fcmToken` set

---

### Activity Logging

All booking mutations trigger activity logs:

```typescript
logActivity(uid, "booking.created", `Created booking: ${serviceName}`, {
  bookingId,
  role: "client",
  amount: escrowCoins
});

logActivity(uid, "booking.confirmed", `Confirmed booking: ${serviceName} from ${clientName}`, {
  bookingId,
  role: "pro"
});

logActivity(uid, "booking.completed", `Completed booking: ${serviceName} for ${clientName}`, {
  bookingId,
  role: "pro",
  escrowReleased: escrowCoins
});

logActivity(uid, "booking.cancelled", `${isClient ? "Cancelled" : "Declined"} booking: ${serviceName}`, {
  bookingId,
  role: isClient ? "client" : "pro",
  escrowRefunded: escrowCoins
});

logActivity(uid, "booking.reviewed", `Reviewed booking: ${serviceName} with ${proName}`, {
  bookingId,
  role: "client"
});
```

**Rate Limiting**: Activity logs rate-limited to 1 per 2 seconds per user per event type (except critical events)

---

### Wallet Integration

**Debit**: `holdEscrow()` deducts from client balance at booking
```typescript
await holdEscrow(clientUid, bookingId, escrowCoins, serviceName);
```

**Credit**: `releaseEscrow()` adds to pro's cashableBalance
```typescript
await releaseEscrow(proUid, bookingId, serviceName, platformFeePct);
```

**Refund**: `refundEscrow()` returns coins to client on cancellation
```typescript
await refundEscrow(clientUid, bookingId, serviceName);
```

**Atomic Cancellation**: `cancelBookingAndRefund()` combines cancel + refund
```typescript
await cancelBookingAndRefund(uid, bookingId, role);
```

---

### Subscription Checks

Business category services require active subscription:

```typescript
// In BrowsePros.tsx
if (BUSINESS_CATEGORIES.includes(service.category)) {
  const sub = await getSubscription(service.userId);
  if (!isSubActive(sub)) {
    // Hide or mark as unavailable
    showSubscriptionRequiredBanner();
  }
}
```

**Active Statuses**: `trial`, `trial_ending`, `active`, `renewing`, `past_due`, `grace`, `comped`

---

## Performance Considerations

### Query Optimization

**Indexed Fields**:
- `bookings`: `clientId`, `proId`, `status`, `createdAt`
- Composite index: `clientId + createdAt DESC`
- Composite index: `proId + createdAt DESC`

**Pagination**: Cursor-based for large result sets
```typescript
const { data, nextCursor } = await getAllBookings(50, cursor);
```

### Caching Strategy

**React Query**:
- Bookings cached for 30 seconds (frequent updates)
- Invalidate after mutations
- Optimistic updates for status changes

**Real-Time Updates**:
```typescript
// For critical bookings, use onSnapshot
const unsubscribe = onSnapshot(doc(db, "bookings", bookingId), snap => {
  setBooking(snap.data());
});
```

### Cloud Function Efficiency

**Rating Recalculation**:
- Full collection scan per review (acceptable for low volume)
- Future optimization: Incremental counter approach if p99 latency > 2s

---

## Testing Coverage

### Unit Tests

**Coverage**:
- ✅ `bookingService.test.ts`: Escrow hold/release, refund logic
- ✅ `booking.test.ts`: Status transitions, validation
- ✅ `coinService.test.ts`: Transaction atomicity

**Test Scenarios**:
- Create booking with escrow
- Confirm booking (pro only)
- Cancel booking with refund
- Complete booking and release escrow
- Review booking
- Insufficient balance handling
- Double-booking prevention
- Idempotency on network retry

### E2E Tests (`e2e/`)

**Test Suites**:
- `booking-flow.spec.ts` — Complete booking lifecycle
- `complete-booking-flow.spec.ts` — End-to-end with payment

**Test Users**:
```bash
npm run seed:test-users
```

**Critical Flows**:
- Browse → Select → Book → Pay → Confirm → Complete → Review
- Cancel with refund
- Insufficient balance handling
- Concurrent booking prevention

---

## Troubleshooting Guide

### Common Issues

**Issue**: Booking stuck in "pending" status
**Cause**: Pro hasn't confirmed yet
**Solution**: Check notifications, contact pro via chat

**Issue**: Coins deducted but booking not created
**Cause**: Transaction failed after debit
**Solution**: Check ledger for refund entry, contact support

**Issue**: Escrow not released after completion
**Cause**: Pro didn't mark as completed
**Solution**: Pro must click "Complete" button, or admin intervention

**Issue**: Review not submitted
**Cause**: Booking not in "completed" status
**Solution**: Pro must complete booking first

**Issue**: Double charge for booking
**Cause**: Network retry without idempotency
**Solution**: Check ledger for duplicate entries, contact support

---

## References

- **docs/architecture.md**: System architecture overview
- **docs/strategies/options-engine.md**: Subscription engine documentation
- **docs/USER-GUIDE.md**: End-user booking guide
- **src/services/bookingService.ts**: Booking service implementation
- **src/services/coinService.ts**: Coin/escrow service implementation
- **firestore.rules**: Security rules for booking transitions
- **functions/src/index.ts**: Cloud Function for rating aggregation
