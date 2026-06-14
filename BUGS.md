# ProNeighbor — Bug Tracking

**Last Updated:** 2026-05-22  
**Critical Audit Fixes:** ✅ **COMPLETED** (See `CRITICAL_FIXES_COMPLETE.md`)

---

## ✅ RESOLVED - Critical Audit Fixes (2026-05-22)

The following 7 critical bugs from `COMPREHENSIVE_CODE_AUDIT_2026.md` have been **FIXED**:

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| CR-1 | 🔴 Critical | Duplicate Payout Race Condition | ✅ FIXED (generation counter) |
| CR-2 | 🔴 Critical | Subscription Overspending | ✅ FIXED (double-check + rules) |
| CR-3 | 🔴 Critical | Profile Bonus Multi-Claim | ✅ FIXED (idempotency key) |
| CR-4 | 🔴 Critical | Trial Duration Bypass | ✅ FIXED (firestore rule) |
| CR-5 | 🔴 Critical | Auth Check Missing | ✅ FIXED (authorizedUid param) |
| CR-6 | 🔴 Critical | Missing Database Indexes | ✅ FIXED (compound indexes) |
| CR-7 | 🔴 Critical | Ledger Desync | ✅ FIXED (balance validation) |

**Documentation:** See `AUDIT_FIXES_VERIFICATION.md`, `DEPLOYMENT_CHECKLIST.md`, `CRITICAL_FIXES_COMPLETE.md`

---

## ⚠️ OPEN - Booking Flow Bugs (Reviewed 2026-05-21)

**Files:** `BookingFlow.tsx`, `BookingDetail.tsx`, `coinService.ts`, `bookingService.ts`

### Summary

| # | Severity | File(s) | Issue | Status |
|---|----------|---------|-------|--------|
| 1 | 🔴 Critical | coinService + bookingService | Duplicate `cancelBookingAndRefund` — auth bypass risk | ⚠️ OPEN |
| 2 | ✅ FIXED | bookingService + coinService | Shared ledger key — distinct keys now used | ✅ FIXED |
| 3 | 🔴 Critical | BookingDetail | Timezone bug in rebook date — off by 1 day for IST users | ⚠️ OPEN |
| 4 | ✅ FIXED | coinService | Wrong default `platformFeePct` (10% vs 15%) | ✅ FIXED |
| 5 | 🟡 Medium | BookingDetail | `rewardReferral` after `releaseEscrow` — no rollback on partial failure | ⚠️ OPEN |
| 6 | 🟡 Medium | BookingDetail | Past date pre-filled in rebook | ⚠️ OPEN |
| 7 | 🟡 Medium | BookingFlow | Orphaned Cloudinary file if booking creation fails | ⚠️ OPEN |
| 8 | 🟢 Low | BookingDetail | Variable shadowing `escrowCoins` | ⚠️ OPEN |
| 9 | 🟢 Low | BookingFlow | No-op `useMemo` on `filteredServices` | ⚠️ OPEN |
| 10 | 🟢 Low | bookingService | `cashableBalance` not updated on refund (dead code) | ⚠️ OPEN |

---

## ✅ FIXED - Bug Details

### 2. ✅ Shared Ledger Key Between `createBooking` + `holdEscrow`

**Files:** `src/services/bookingService.ts`, `src/services/coinService.ts`  
**Status:** ✅ **FIXED** (2026-05-22)

**Issue:** Both used the same idempotency key: `${bookingId}_hold_${clientId}`

**Fix Applied:** `createBooking` now uses `${bookingId}_create_hold_${clientId}` (distinct key)

---

### 4. ✅ Wrong Default `platformFeePct` in `releaseEscrow`

**File:** `src/services/coinService.ts`  
**Status:** ✅ **FIXED** (2026-05-22)

**Issue:** Default was `0.10` (10%) instead of `0.15` (15%)

**Fix Applied:** Changed default to `0.15` to match `NC_TERMS_DEFAULTS.platformFeePct`

---

## ⚠️ OPEN - Bug Details

### 1. 🔴 Duplicate `cancelBookingAndRefund` — Auth Bypass Risk

**Files:** `src/services/coinService.ts`, `src/services/bookingService.ts`

Both files export `cancelBookingAndRefund` with different signatures:
- `coinService`: `(uid, bookingId, role)` — enforces role, updates `cashableBalance` ✅
- `bookingService`: `(bookingId)` — no uid/role check, missing `cashableBalance` update ❌

`BookingDetail.tsx` imports from `coinService` (correct). The `bookingService` version is dead code today but any accidental import swap silently bypasses auth/role checks.

**Fix:** Remove `cancelBookingAndRefund` from `bookingService.ts` entirely.

---

### 2. ✅ Shared Ledger Key Between `createBooking` + `holdEscrow`

**RESOLVED** - See above

---

### 3. 🔴 Timezone Bug in Rebook Date (IST Off-by-One)

**File:** `src/pages/BookingDetail.tsx` → `buildRecurringRebookQuery()`

```ts
// BUG: parses as UTC midnight — in IST (UTC+5:30) getDate() returns previous day
const base = booking.date ? new Date(String(booking.date)) : new Date();
```

`new Date("2025-06-01")` → UTC midnight → IST renders as May 31. All IST users get wrong rebook date.

**Fix:**
```ts
const [y, m, d] = String(booking.date).split("-").map(Number);
const base = new Date(y, m - 1, d); // local timezone — no UTC shift
```

---

### 4. ✅ Wrong Default `platformFeePct` in `releaseEscrow`

**RESOLVED** - See above

---

### 5. 🟡 `rewardReferral` — No Rollback if `releaseEscrow` Partially Fails

**File:** `src/pages/BookingDetail.tsx` → `submitCompletion()`

```ts
const result = await releaseEscrow(...);   // sets booking.status = "completed"
await rewardReferral(booking.clientId, id); // reads booking.status — no retry/rollback
```

`rewardReferral` checks `booking.status === "completed"` inside its transaction. If `releaseEscrow` writes partially (status updated, ledger failed), `rewardReferral` may fire on corrupt state. No error handling on `rewardReferral` failure either — it's fire-and-forget via `.catch(captureError)`.

**Fix:** Wrap both in a single coordinated flow or accept eventual consistency and add proper retry logging.

---

### 6. 🟡 Past Date Pre-filled in Rebook

**File:** `src/pages/BookingDetail.tsx` → `buildRecurringRebookQuery()`

```ts
next.setDate(next.getDate() + 7);
// No guard — if booking.date is old, next is still in the past
```

Old bookings pre-fill a past rebook date. Date picker `min` attribute on BookingFlow blocks selection, but the pre-fill causes UX confusion.

**Fix:**
```ts
const today = new Date();
today.setHours(0, 0, 0, 0);
if (next < today) next = today;
```

---

### 7. 🟡 Orphaned Cloudinary File on Booking Failure

**File:** `src/pages/BookingFlow.tsx` → `handleSubmit()`

```ts
attachData = await uploadBookingAttachment(null, attachment); // uploaded first
const bookingId = await createBooking({ ...attachData });     // if this fails → orphan
```

File uploaded to Cloudinary before booking exists. If `createBooking()` throws, the file is orphaned with no cleanup or retry mechanism.

**Fix:** Upload after booking is created (pass `bookingId`), or implement a cleanup/TTL mechanism on Cloudinary for unlinked uploads.

---

### 8. 🟢 Variable Shadowing — `escrowCoins`

**File:** `src/pages/BookingDetail.tsx`

```ts
const escrowCoins = (booking.escrowCoins as number) || 0; // outer scope ~line 50

const submitCompletion = async () => {
  const escrowCoins = (booking.escrowCoins as number) || 0; // re-declared — shadows outer
  ...
};
// logActivity below uses outer escrowCoins — divergence risk on refactor
```

**Fix:** Remove inner redeclaration. Use outer-scope `escrowCoins`.

---

### 9. 🟢 No-op `useMemo` on `filteredServices`

**File:** `src/pages/BookingFlow.tsx`

```ts
const filteredServices = useMemo(() => services, [services]); // returns services unchanged
```

Zero filtering logic. Memo overhead with no benefit.

**Fix:** Remove `filteredServices`, use `services` directly. Add actual filter logic if intended.

---

### 10. 🟢 `cashableBalance` Not Updated on Refund (Dead Code)

**File:** `src/services/bookingService.ts` → `cancelBookingAndRefund()`

```ts
tx.update(userRef, { coinBalance: newBalance, updatedAt: ... });
// Missing: cashableBalance update
```

`coinService.ts` version correctly updates both `coinBalance` + `cashableBalance`. This version (dead code) doesn't. If ever called, leaves `cashableBalance` stale — user can't withdraw refunded coins.

**Fix:** Delete this function (see Bug #1). If kept, add `cashableBalance: newCashable`.
