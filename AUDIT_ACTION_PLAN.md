# ProNeighbor Audit — Prioritized Action Plan

**Status:** 🔴 **CRITICAL** — 7 Production-Breaking Issues Identified  
**Timeline:** Fix-and-Deploy Required Before Any New Features

---

## 🚨 EMERGENCY (Deploy Today)

### Task 1: Deploy Firestore Indexes (CR-6)
**Time:** 30 min | **Risk:** 🟢 **Low** | **Impact:** Prevents query timeouts

**Steps:**
```bash
# Update firestore.indexes.json with compound indexes for ledger queries
cat > firestore.indexes.json << 'EOF'
{
  "indexes": [
    {
      "collectionGroup": "entries",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "entries",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collection": "coinPayouts",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collection": "subscriptions",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "currentPeriodEnd", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
EOF

firebase deploy --only firestore:indexes
```

**Verify:** Check Firestore Console → Indexes → Confirm all indexes are ENABLED (green check)

---

### Task 2: Fix Subscription Balance Validation (CR-2)
**Time:** 1 hour | **Risk:** 🟡 **Medium** | **Impact:** Prevents overspending

**File:** `src/services/subscriptionService.ts`

```typescript
// BEFORE (Line 241-243)
if (cashableBalance < price) throw new Error("INSUFFICIENT_CASHABLE_BALANCE");

const existingSubSnap = await tx.get(doc(db, "subscriptions", subId));

// AFTER
if (cashableBalance < price) throw new Error("INSUFFICIENT_CASHABLE_BALANCE");

// NEW: Read twice inside transaction to catch concurrent earnings
// First read already happened above (snap), recheck before debit
const balanceCheck = await tx.get(userRef);  // Fresh read within transaction
const finalBalance = (balanceCheck.data()?.cashableBalance as number) ?? 0;
if (finalBalance < price) {
  throw new Error("INSUFFICIENT_CASHABLE_BALANCE");
}

const existingSubSnap = await tx.get(doc(db, "subscriptions", subId));
```

**Plus add Firestore rule validation** (Line ~290 in firestore.rules):
```
function validLedgerEntry(uid) {
  // NEW: Ensure ledger debit doesn't exceed recorded balance
  return request.resource.data.uid == uid
    && request.resource.data.type in [...]
    && (
      request.resource.data.type != "subscription_debit"
      || (
        request.resource.data.amount <= 0
        && Math.abs(request.resource.data.amount) <= getAfter(/databases/.../users/$(uid)).data.cashableBalance
      )
    )
    // ... rest unchanged
}
```

**Test:**
```bash
npm run test -- subscriptionService.test.ts
```

---

### Task 3: Fix Payout Request Race (CR-1)
**Time:** 45 min | **Risk:** 🟡 **Medium** | **Impact:** Prevents duplicate payouts

**File:** `src/services/coinService.ts` → `requestPayout()` (Line ~540)

**Change:**
```typescript
// BEFORE (Line 553)
const sentinelSnap = await tx.get(sentinelRef);
if (sentinelSnap.exists() && sentinelSnap.data()?.status === "pending") {
  throw new Error("DUPLICATE_PAYOUT");
}

// AFTER: Use generation counter for conflict detection
const sentinelSnap = await tx.get(sentinelRef);
if (sentinelSnap.exists() && sentinelSnap.data()?.status === "pending") {
  throw new Error("DUPLICATE_PAYOUT");
}

// NEW: Increment generation to force transaction conflict on concurrent request
const newGen = ((sentinelSnap.data()?.generation ?? 0) as number) + 1;
tx.set(sentinelRef, { 
  uid, 
  status: "pending", 
  payoutId: payoutRef.id, 
  generation: newGen,  // ← NEW: conflict detector
  createdAt: serverTimestamp() 
});
```

**Plus** update cancellation (Line ~602) to reset generation:
```typescript
// Clear sentinel so user can submit new payout
tx.set(doc(db, "payoutLock", uid), { 
  uid, 
  status: "idle", 
  generation: 0,  // ← NEW: reset for next payout
  updatedAt: serverTimestamp() 
});
```

**Test:**
```bash
npm run test -- coinService.test.ts
# Specifically test concurrent payout scenario
```

---

### Task 4: Add Auth Check to Booking Status (CR-5)
**Time:** 30 min | **Risk:** 🟢 **Low** | **Impact:** Prevents auth bypass

**File:** `src/services/bookingService.ts` → `updateBookingStatus()` (Line 87)

**Change:**
```typescript
// BEFORE (Line 87)
export async function updateBookingStatus(bookingId: string, status: string) {

// AFTER (Line 87)
export async function updateBookingStatus(
  bookingId: string,
  status: string,
  authorizedUid?: string  // NEW: explicit auth for CF/admin contexts
) {
```

**Plus** (Line 102):
```typescript
// BEFORE
currentUserId = auth.currentUser?.uid ?? null;

// AFTER
currentUserId = authorizedUid ?? auth.currentUser?.uid ?? null;

// NEW: Validate auth exists
if (!currentUserId) {
  throw new Error("NOT_AUTHENTICATED");
}
```

**Update all callers:**
```bash
grep -r "updateBookingStatus" src/pages/ src/components/
# Verify none pass extra args (should fail cleanly with new signature)
```

---

## ⚠️ CRITICAL (Fix This Sprint)

### Task 5: Fix Trial Duration Enforcement (CR-4)
**Time:** 1 hour | **Risk:** 🟡 **Medium** | **Impact:** Prevents unlimited trials

**File:** `firestore.rules` (Line ~365)

**Add validation to subscription update rule:**
```typescript
// BEFORE (Line 365)
match /subscriptions/{subId} {
  allow read: if isSignedIn() && (resource.data.uid == request.auth.uid || isAdmin());
  allow create: if ...;
  allow update: if isAdmin();
}

// AFTER
match /subscriptions/{subId} {
  allow read: if isSignedIn() && (resource.data.uid == request.auth.uid || isAdmin());
  allow create: if ...;
  allow update: if isAdmin() && (
    // Trial subscriptions cannot extend past 30 days
    (!('source' in resource.data) || resource.data.source != 'trial')
    || (
      resource.data.source == 'trial'
      && request.resource.data.currentPeriodEnd <= 
         request.resource.data.currentPeriodStart + duration.time(30, 'd')
    )
  );
}
```

**Deploy:**
```bash
firebase deploy --only firestore:rules
```

---

### Task 6: Fix Profile Bonus Multiple Claims (CR-3)
**Time:** 45 min | **Risk:** 🟡 **Medium** | **Impact:** Prevents duplicate rewards

**File:** `src/services/coinService.ts` → `earnCoins()` (Line ~670)

**Change deduplication key:**
```typescript
// BEFORE (Line 679)
const dedupDocId = refId ? `${uid}_${type}_${refId}` : `${uid}_${type}`;

// AFTER: Always include type in key for proper scoping
const dedupDocId = `${uid}_${type}_${refId || 'singleton'}`;
```

**File:** `src/contexts/AuthContext.tsx` (Line ~210)

**Simplify profile bonus:**
```typescript
// BEFORE
if (!profileBonusClaimedRef.current && isProfileComplete(data)) {
  profileBonusClaimedRef.current = true;
  earnCoins(user.uid, "earn_profile", user.uid).catch(...)
}

// AFTER: Remove local guard — rely on Firestore idempotency
if (isProfileComplete(data)) {
  earnCoins(user.uid, "earn_profile", user.uid).catch((error: unknown) => {
    captureError(error, { operation: "earn_profile_on_snapshot", uid: user.uid });
    // Note: idempotent, safe to retry on snapshot update
  });
}
```

**Test:**
```bash
npm run test -- coinService.test.ts
# Add test for concurrent earnCoins calls
```

---

### Task 7: Add Referral Code Uniqueness (HP-4)
**Time:** 1 hour | **Risk:** 🟡 **Medium** | **Impact:** Prevents reward collisions

**File:** `firestore.rules` (Line ~50)

**Update referral code creation rule:**
```typescript
// BEFORE (Line 50-53)
match /referralCodes/{code} {
  allow get: if isSignedIn();
  allow list: if false;
  allow create: if isSignedIn()
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.code == code
    && request.resource.data.code is string
    && request.resource.data.code.matches('^PN[A-Z0-9]{6}$');
}

// AFTER
match /referralCodes/{code} {
  allow get: if isSignedIn();
  allow list: if false;
  allow create: if isSignedIn()
    && !exists(resource)  // ← NEW: Prevent collision
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.code == code
    && request.resource.data.code is string
    && request.resource.data.code.matches('^PN[A-Z0-9]{6}$');
}
```

**Plus add retry in service** (update `src/services/coinService.ts` around line ~120):
```typescript
export async function generateUniqueReferralCode(params: {
  displayName?: string;
  phoneNumber?: string;
  uid?: string;
}): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = generateReferralCode({
      ...params,
      uid: (params.uid ?? "") + (i > 0 ? `_${i}` : ""),
    });

    try {
      const codeRef = doc(db, "referralCodes", code);
      await setDoc(codeRef, { uid: params.uid, createdAt: serverTimestamp() });
      return code;
    } catch (err: unknown) {
      if (i === 4) throw new Error("Unable to generate unique referral code");
      // Retry with modified seed
    }
  }
  throw new Error("Failed to generate referral code");
}
```

---

## 📋 FOLLOW-UP (Next Sprint)

### Task 8: Fix Cloudinary Orphan Upload (HP-1)
**Time:** 1.5 hours | **Risk:** 🟢 **Low** | **Impact:** Prevents storage leak

**File:** `src/pages/BookingFlow.tsx` → `handleSubmit()` (Line ~180)

See COMPREHENSIVE_CODE_AUDIT_2026.md § HP-1 for full fix.

---

### Task 9: Add Subscription Cache Invalidation (HP-2)
**Time:** 1 hour | **Risk:** 🟢 **Low** | **Impact:** Ensures fresh subscription status

**File:** `src/services/subscriptionService.ts`

Add cache invalidation after each subscription mutation:
```typescript
async function subscribeWithNC(...) {
  // ... existing code ...
  
  const result = await runTransaction(...);
  
  // NEW: Invalidate caches
  queryClient.invalidateQueries({ queryKey: ['userSubscription', uid] });
  queryClient.invalidateQueries({ queryKey: ['userProfile', uid] });
  
  return result;
}
```

---

## 🔍 Verification Checklist

**Before Deployment:**
- [ ] All Firestore indexes deployed and enabled
- [ ] Payout request tests pass (no duplicate payouts)
- [ ] Subscription balance tests pass (no overspending)
- [ ] Trial duration tests pass (no extended trials)
- [ ] Profile bonus tests pass (no duplicates)
- [ ] Referral code tests pass (no collisions)
- [ ] Auth check tests pass (proper authorization)
- [ ] E2E test: Full booking flow (create → complete → earn referral)
- [ ] E2E test: Concurrent payout requests
- [ ] E2E test: Cross-tab auth sync
- [ ] Production index usage metrics stable (<500ms p99)

---

## 📊 Deployment Plan

### Phase 1: Firestore (Day 1)
1. Deploy indexes
2. Wait for index enablement (5-10 min in Firestore UI)
3. Verify no regressions

### Phase 2: Rules & Service Layer (Day 2)
1. Deploy firestore.rules updates
2. Deploy service code fixes
3. Run E2E tests in production
4. Monitor error logs via Sentry

### Phase 3: Component Updates (Day 3)
1. Deploy component changes (AuthContext, BookingFlow)
2. Gradual rollout (10% → 50% → 100%)
3. Monitor user engagement metrics

---

## 🚨 Rollback Plan

If production issues:
1. **Firestore Indexes:** Disable problematic indexes (no code rollback needed)
2. **Firestore Rules:** Revert to previous version via Git
3. **Service Code:** Deploy previous commit with `firebase deploy --only functions`
4. **Components:** Revert to previous Git tag

**Command:**
```bash
git revert <commit-hash>
firebase deploy
```

---

## 📧 Communication

**To QA:** "Critical fixes deployed. Please retest: payout flow, subscription, booking completion, referral rewards."

**To Users (if needed):** "Brief maintenance window (2-3 min) to improve payment processing stability."

---

**Prepared:** 2026-05-21  
**Approved By:** [Pending Review]  
**Target Deployment:** 2026-05-22 (EOD)
