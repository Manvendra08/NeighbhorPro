# NeighbhorPro — Bug Fix Implementation Plan

> **Scope:** 5 confirmed bugs + 5 improvements identified in code review of `main` branch.  
> **Stack:** React + TypeScript, Firebase Firestore (Spark plan), Vite  
> **Priority order:** P0 (data integrity) → P1 (security) → P2 (code quality)

---

## Fix #1 — `requestPayout`: Non-Transactional `getDocs` Inside `runTransaction`

**File:** `src/services/coinService.ts`  
**Priority:** 🔴 P0 — Data integrity bug. TOCTOU protection is illusory despite changelog claiming otherwise.

### Root Cause

`getDocs()` is a standard Firestore read — it does **not** participate in the transaction's read set. Two concurrent payout calls can both pass the pending-payout check and create duplicate payout documents.

### Fix

Replace the `getDocs` check with a deterministic sentinel document keyed to the user UID. The sentinel is read via `tx.get()`, making it truly transactional.

**Step 1:** In `requestPayout`, replace the `getDocs` block:

```ts
// ❌ REMOVE — not transactional
const pendingPayoutsSnap = await getDocs(
  query(collection(db, "coinPayouts"), where("uid", "==", uid), where("status", "==", "pending"), limit(1))
);
if (!pendingPayoutsSnap.empty) throw new Error("DUPLICATE_PAYOUT");
```

**Step 2:** Add a sentinel document strategy:

```ts
// ✅ REPLACE WITH — transactional check via sentinel doc
const sentinelRef = doc(db, "payoutLock", uid);
const sentinelSnap = await tx.get(sentinelRef);
if (sentinelSnap.exists() && sentinelSnap.data()?.status === "pending") {
  throw new Error("DUPLICATE_PAYOUT");
}

// ... rest of transaction logic ...

// Write sentinel alongside payout creation
tx.set(sentinelRef, { uid, status: "pending", createdAt: serverTimestamp() });
```

**Step 3:** When admin processes or user cancels a payout, clear or update the sentinel:

```ts
// In admin payout processing (Cloud Function or admin service):
tx.set(doc(db, "payoutLock", uid), { uid, status: "idle", updatedAt: serverTimestamp() });
```

**Step 4:** Add `payoutLock` collection to Firestore rules:

```
match /payoutLock/{uid} {
  allow read: if isSignedIn() && isOwner(uid);
  allow write: if false; // service layer only
}
```

---

## Fix #2 — `releaseEscrow`: Zero-Escrow Early Return Ignores Existing `escrowStatus`

**File:** `src/services/coinService.ts`  
**Priority:** 🔴 P0 — A cancelled (refunded) booking can be re-completed by the pro.

### Root Cause

When `escrowCoins === 0`, the function marks booking as `"completed"` without verifying that `escrowStatus` isn't already `"refunded"` or `"released"`.

### Fix

```ts
// ❌ CURRENT — missing status guard
if (escrowCoins === 0) {
  tx.update(bookingRef, {
    status: "completed",
    completedAt: serverTimestamp(),
    completedBy: proUid,
    updatedAt: serverTimestamp(),
  });
  return;
}
```

```ts
// ✅ FIXED — check escrowStatus first
const escrowStatus = data.escrowStatus as string | undefined;

if (escrowStatus === "refunded" || escrowStatus === "released") {
  return; // already finalized, no-op
}

if (escrowCoins === 0) {
  tx.update(bookingRef, {
    status: "completed",
    completedAt: serverTimestamp(),
    completedBy: proUid,
    updatedAt: serverTimestamp(),
  });
  return;
}
```

---

## Fix #3 — `firestore.rules`: `coinPayouts` Create Missing Field Validation

**File:** `firestore.rules`  
**Priority:** 🔴 P1 — Any authenticated user can self-create a payout document with arbitrary `status`, `amountRs`, and `coinsRedeemed`.

### Fix

Replace the current permissive create rule:

```
// ❌ CURRENT
allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;
```

```
// ✅ FIXED
allow create: if isSignedIn()
  && request.resource.data.uid == request.auth.uid
  && request.resource.data.status == "pending"
  && request.resource.data.coinsRedeemed is int
  && request.resource.data.coinsRedeemed >= 200
  && request.resource.data.coinsRedeemed <= 10000
  && request.resource.data.amountRs is int
  && request.resource.data.amountRs == request.resource.data.coinsRedeemed
  && request.resource.data.upiId is string
  && request.resource.data.upiId.size() > 0
  && request.resource.data.upiId.size() <= 100
  && !request.resource.data.keys().hasAny(['processedBy', 'processedAt']);
```

---

## Fix #4 — `firestore.rules`: `ownerWalletMutationAllowed` Missing `cashableBalance`

**File:** `firestore.rules`  
**Priority:** 🟠 P1 — Silently blocks valid writes from `topUpCoins`, `releaseEscrow`, `refundEscrow`, and `cancelBookingAndRefund` if `cashableBalance` is in the diff.

### Root Cause

The `ownerWalletMutationAllowed` function uses `hasOnly(["coinBalance", "updatedAt", "lastLedgerEntryId"])` but the service layer also writes `cashableBalance` in the same user document update.

### Fix

```
// ❌ CURRENT
function ownerWalletMutationAllowed(userId) {
  let changed = request.resource.data.diff(resource.data).affectedKeys();
  ...
  return changed.hasOnly(["coinBalance", "updatedAt", "lastLedgerEntryId"])
  ...
}
```

```
// ✅ FIXED — add cashableBalance to allowed keys
function ownerWalletMutationAllowed(userId) {
  let changed = request.resource.data.diff(resource.data).affectedKeys();
  let ledgerPath = /databases/$(database)/documents/coinLedger/$(userId)/entries/$(request.resource.data.lastLedgerEntryId);
  return changed.hasOnly(["coinBalance", "cashableBalance", "updatedAt", "lastLedgerEntryId"])
    && request.resource.data.lastLedgerEntryId is string
    && request.resource.data.lastLedgerEntryId.size() > 0
    && request.resource.data.coinBalance is int
    && request.resource.data.coinBalance >= 0
    && (!('cashableBalance' in request.resource.data) || (
        request.resource.data.cashableBalance is int
        && request.resource.data.cashableBalance >= 0
    ))
    && existsAfter(ledgerPath)
    && getAfter(ledgerPath).data.uid == userId
    && getAfter(ledgerPath).data.type in [
      'booking_debit', 'booking_refund', 'booking_escrow',
      'booking_escrow_release', 'payout', 'payout_cancelled',
      'earn_signup_bonus', 'earn_profile', 'earn_referral',
      'earn_review', 'earn_free_consult'
    ]
    && getAfter(ledgerPath).data.balanceAfter == request.resource.data.coinBalance;
}
```

---

## Fix #5 — `rewardReferral`: Missing `nSnap.exists()` Guard

**File:** `src/services/coinService.ts`  
**Priority:** 🟠 P1 — Unhandled transaction failure on partially created user accounts.

### Fix

```ts
// ❌ CURRENT — no existence check
const nRef = doc(db, "users", newUserUid);
const nSnap = await tx.get(nRef);
const nBal = ((nSnap.data()?.coinBalance as number) ?? 0) + rule.coins;
tx.update(nRef, { coinBalance: nBal, ... });
```

```ts
// ✅ FIXED
const nRef = doc(db, "users", newUserUid);
const nSnap = await tx.get(nRef);
if (!nSnap.exists()) {
  throw new Error("USER_NOT_FOUND");
}
const nBal = ((nSnap.data()?.coinBalance as number) ?? 0) + rule.coins;
tx.update(nRef, { coinBalance: nBal, ... });
```

No error handling change needed at the call site — `rewardReferral` already throws on failure, and callers are responsible for retry logic.

---

## Fix #6 — `validLedgerEntry`: Raise `amount` Cap

**File:** `firestore.rules`  
**Priority:** 🟡 P2 — Cap of ±5000 will reject large pack top-ups if packs expand. Society pack is already 2500+500=3000.

### Fix

```
// ❌ CURRENT
&& request.resource.data.amount >= -5000
&& request.resource.data.amount <= 5000
```

```
// ✅ FIXED — headroom for future pack sizes
&& request.resource.data.amount >= -10000
&& request.resource.data.amount <= 10000
```

---

## Fix #7 — `localFeed`: `likeCount` Gameable Without Per-User Ownership

**File:** `firestore.rules`  
**Priority:** 🟡 P2 — Any user can set `likeCount` to any value ≤ 100,000.

### Recommended Fix

Track individual likes as subcollection documents (standard Firestore pattern), or enforce that `likeCount` can only change by ±1 per write:

```
// ✅ OPTION A — enforce delta of ±1
allow update: if isAdmin() || (
  isSignedIn()
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
       'reactions', 'likes', 'likeCount', 'updatedAt'
     ])
  && request.resource.data.likeCount is int
  && request.resource.data.likeCount >= 0
  && request.resource.data.likeCount <= 100000
  && (request.resource.data.likeCount == resource.data.likeCount + 1
      || request.resource.data.likeCount == resource.data.likeCount - 1)
);
```

---

## Fix #8 — Remove Dead Code in `generateReferralCode`

**File:** `src/services/coinService.ts`  
**Priority:** 🟡 P2 — The displayName + phone fallback is never reached. Firebase Auth UIDs are always 28 chars.

### Fix

```ts
// ✅ SIMPLIFIED — remove dead branches
export function generateReferralCode(uid: string): string {
  const uidSeed = uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `PN${uidSeed.slice(-6)}`;
}

// Update call sites:
export async function generateUniqueReferralCode(uid: string): Promise<string> {
  return generateReferralCode(uid);
}
```

Update callers that pass `{ displayName, phoneNumber, uid }` to just pass `uid`.

---

## Fix #9 — Remove `payForBooking` Lying Type Alias

**File:** `src/services/coinService.ts`  
**Priority:** 🟡 P2 — The `as unknown as` cast silently drops `proUid` parameter.

### Fix

```ts
// ❌ REMOVE entirely
export const payForBooking = holdEscrow as unknown as (
  clientUid: string, proUid: string, bookingId: string, coins: number, serviceName: string
) => Promise<{ success: boolean; reason?: string }>;
```

Search for all `payForBooking` usages and replace with direct `holdEscrow` calls:

```ts
// ✅ DIRECT — no cast needed
const result = await holdEscrow(clientUid, bookingId, coins, serviceName);
```

Run a project-wide grep: `grep -r "payForBooking" src/` to find all call sites before deleting.

---

## Fix #10 — CSS Architecture Consolidation

**File:** `src/index.css`, `src/darkmode.css`, `src/mobile.css`, `src/responsive.css`, `src/pwa.css`  
**Priority:** 🟡 P2 — 5 separate CSS files (index.css alone is 64KB) will cause specificity conflicts at scale.

### Recommended Approach

Migrate to Tailwind v4 (already likely in the Vite stack) with a single `app.css` entry point:

```
src/
  styles/
    tokens.css       ← CSS custom properties (colors, spacing, radius)
    base.css         ← resets, typography defaults
    components.css   ← shared component classes
    dark.css         ← @media (prefers-color-scheme: dark) + [data-theme="dark"]
    pwa.css          ← standalone/pwa @media queries only
```

Or, at minimum, merge `darkmode.css`, `mobile.css`, and `responsive.css` into `index.css` under proper `@media` and `@layer` blocks to restore cascade control.

---

## Execution Checklist

| # | File | Change Type | Test Required |
|---|------|-------------|---------------|
| 1 | `coinService.ts` | Logic rewrite | Concurrent payout test (2 simultaneous requests) |
| 2 | `coinService.ts` | Guard addition | Cancel-then-complete booking flow |
| 3 | `firestore.rules` | Rule hardening | Firestore emulator rules test |
| 4 | `firestore.rules` | Rule expansion | Payout + topup end-to-end flow |
| 5 | `coinService.ts` | Guard addition | Referral with deleted user doc |
| 6 | `firestore.rules` | Value cap increase | Large pack topup write |
| 7 | `firestore.rules` | Delta constraint | Like/unlike post |
| 8 | `coinService.ts` | Dead code removal | Referral code generation |
| 9 | `coinService.ts` | Alias removal | Grep all call sites, update |
| 10 | `src/styles/` | Refactor | Visual regression check |

### Testing Recommended

For Fixes #1–#5, run against the **Firestore Emulator** with concurrent test cases before deploying to production. The `src/__tests__` and `src/test` directories already exist — add test files there.

```bash
# Spin up emulator suite
firebase emulators:start --only firestore

# Run existing test suite
npx vitest run
```

