# ProNeighbor Code Audit Report

**Date:** 2026-05-21  
**Auditor:** Claude Code  
**Scope:** Full codebase audit focusing on security, bugs, and code quality

---

## Executive Summary

The ProNeighbor codebase demonstrates strong security foundations with Firestore rules, transactional patterns, and input validation. However, there are **critical type safety issues**, **code organization concerns**, and **minor security/stability risks** that need attention.

**High-Priority Issues:** 4  
**Medium-Priority Issues:** 5  
**Low-Priority Issues:** 4  
**Total Issues:** 13

---

## Critical Issues

### 1. 🔴 Type Safety: `any` Type Usage in Service Layer

**Severity:** CRITICAL  
**Files:** `src/services/serviceService.ts:57`, `src/pages/Profile.tsx:284`  
**Impact:** Type safety bypass enables silent errors

**Details:**
```typescript
// serviceService.ts:57 - UNSAFE
return services.filter((service: any) => {
  const status = String(service.status || "").trim().toLowerCase();
  return isPublicStatus && service.subStatus !== "paused_subscription";
});

// Profile.tsx:284 - UNSAFE
catch (err: any) {
  alert(err.message || "Failed to create service.");
  return;
}
```

**Fix:**
```typescript
// Use Record<string, unknown> + proper narrowing
return services.filter((service: Record<string, unknown>) => {
  const status = String(service.status || "").trim().toLowerCase();
  return isPublicStatus && service.subStatus !== "paused_subscription";
});

// Use unknown + type guard
catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Failed to create service.";
  alert(message);
  return;
}
```

---

### 2. 🔴 Type Safety: `Record<string, any>` in Component State

**Severity:** CRITICAL  
**File:** `src/pages/BookingFlow.tsx:32`  
**Impact:** Loose typing on availability state

**Code:**
```typescript
const [proAvail, setProAvail] = useState<Record<string, any> | null>(null);
```

**Fix:** Define explicit interface:
```typescript
interface ProAvailability {
  [day: string]: {
    active: boolean;
    slots: string[];
  };
}
const [proAvail, setProAvail] = useState<ProAvailability | null>(null);
```

---

### 3. 🔴 Code Organization: coinService.ts Exceeds Size Limit

**Severity:** CRITICAL  
**File:** `src/services/coinService.ts` (992 lines)  
**Guideline:** Max 800 lines per file  
**Impact:** Hard to test, maintain, and understand

**Suggested Refactoring:**
- Extract `topUpCoins()`, `releaseEscrow()`, `rewardReferral()` → `coinOperations.ts`
- Extract `requestPayout()`, `getPayout()`, `processPayout()` → `payoutService.ts`
- Extract `applyReferralCodeAtSignup()`, `getActiveReferralCode()` → `referralService.ts`
- Keep core types and utilities in `coinService.ts`

---

### 4. 🔴 Unsafe Random Generation for Ticket IDs

**Severity:** CRITICAL  
**File:** `src/services/supportService.ts:82`  
**Impact:** Predictable ticket numbers; collision risk

**Code:**
```typescript
catch {
  const seq = String(Math.floor(Math.random() * 900) + 100); // UNSAFE
  return `NP${dateStr}${seq}`;
}
```

**Fix:** Use crypto or MongoDB ObjectID:
```typescript
catch {
  const seq = String(crypto.getRandomValues(new Uint8Array(2))).slice(0, 3).padStart(3, '0');
  return `NP${dateStr}${seq}`;
}
```

---

## High-Priority Issues

### 5. 🟠 Console.log in Production Code

**Severity:** HIGH  
**File:** `src/services/notificationService.ts:65`  
**Impact:** Leaks internal state; violates no-console-log rule

**Code:**
```typescript
console.log("[FCM] Token registered successfully.");
```

**Fix:** Remove entirely or use Sentry/proper logger:
```typescript
captureMessage("[FCM] Token registered successfully", "info");
```

---

### 6. 🟠 Silent Error Catch Blocks (No Logging)

**Severity:** HIGH  
**Files:** Multiple (BookingDetail.tsx, BookingFlow.tsx, etc.)  
**Impact:** Difficult to debug production issues

**Examples:**
```typescript
// BookingDetail.tsx:131
} catch {
  setError("Failed to cancel.");
}

// BookingDetail.tsx:163
} catch {
  setError("Failed to complete booking.");
}
```

**Fix:** Log errors for monitoring:
```typescript
} catch (err: unknown) {
  captureError(err, { operation: "cancel_booking", bookingId: id });
  setError("Failed to cancel.");
}
```

---

### 7. 🟠 Missing Error Handling in Critical Flows

**Severity:** HIGH  
**File:** `src/pages/BookingDetail.tsx:157` (rewardReferral fire-and-forget)  
**Impact:** Referral rewards may fail silently

**Code:**
```typescript
await rewardReferral(booking.clientId as string, id).catch((error: unknown) => {
  // Fires after releaseEscrow — no rollback/retry if this fails
  captureError(error, { operation: "reward_referral" });
});
```

**Fix:** Implement retry logic or eventual consistency handler:
```typescript
try {
  await rewardReferral(booking.clientId as string, id);
} catch (err: unknown) {
  captureError(err, { operation: "reward_referral", retryable: true });
  // Queue for async retry or admin review
}
```

---

### 8. 🟠 Missing Input Validation in Profile Update

**Severity:** HIGH  
**File:** `src/pages/Profile.tsx:190`  
**Impact:** No validation feedback for phone numbers

**Code:**
```typescript
else if (!phoneRegex.test(normalizedPhone)) 
  nextErrors.phoneNumber = "Invalid Indian mobile number. Use +91XXXXXXXXXX or +91-XXXXXXXXXX.";
```

**Issue:** Validation happens after state update; no early return or UX indication.

---

### 9. 🟠 Firestore Rules: Potentially Weak Subscription Validation

**Severity:** HIGH  
**File:** `firestore.rules:227-231`  
**Impact:** Subscription status check relies on `in` operator without null guard

**Code:**
```typescript
(!(request.resource.data.category in ['Tuition & Coaching', ...])
    || (
      'subscription' in get(...).data
      && get(...).data.subscription.status in [...]
    ))
```

**Risk:** If `subscription` exists but `status` is missing, rule silently allows creation.

**Fix:** Add explicit null checks:
```typescript
(&& request.resource.data.subscription != null
 && request.resource.data.subscription.status != null
 && request.resource.data.subscription.status in [...])
```

---

## Medium-Priority Issues

### 10. 🟡 Missing Null Checks in Booking Validation

**Severity:** MEDIUM  
**File:** `src/pages/BookingDetail.tsx:68`  
**Impact:** Could crash if booking data is malformed

**Code:**
```typescript
if (b && (b.clientId === user.uid || b.proId === user.uid)) {
  // No check that clientId/proId are non-null strings
}
```

**Fix:**
```typescript
if (b && 
    typeof b.clientId === 'string' && 
    typeof b.proId === 'string' && 
    (b.clientId === user.uid || b.proId === user.uid)) {
  setBooking(b);
}
```

---

### 11. 🟡 AdminBroadcast innerHTML Could Be Unsafe

**Severity:** MEDIUM  
**File:** `src/pages/admin/AdminBroadcast.tsx:245, 122, 176`  
**Impact:** While DOMPurify is used in render, direct innerHTML on edit could bypass sanitization

**Code:**
```typescript
const html = (e.currentTarget as HTMLDivElement).innerHTML;
setForm(prev => ({ ...prev, bodyHtml: html, body: stripHtml(html) }));

// Later:
dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(form.bodyHtml || "...") }}
```

**Note:** DOMPurify IS used in render (line 302, 391), so XSS is mitigated. However, the edit flow reads raw HTML which could be confusing.

**Fix:** Ensure input sanitization happens immediately on capture:
```typescript
const rawHtml = (e.currentTarget as HTMLDivElement).innerHTML;
const safeHtml = sanitizeAnnouncementHtml(rawHtml);
setForm(prev => ({ ...prev, bodyHtml: safeHtml, body: stripHtml(safeHtml) }));
```

---

### 12. 🟡 Transaction Atomicity: rewardReferral Not Atomic with releaseEscrow

**Severity:** MEDIUM  
**File:** `src/pages/BookingDetail.tsx:145-157`  
**Impact:** If releaseEscrow succeeds but rewardReferral fails, booking is marked complete but referrer unrewarded

**Current Flow:**
```typescript
const result = await releaseEscrow(...);   // Sets booking.status = "completed"
await rewardReferral(booking.clientId, id); // Fire-and-forget
```

**Options:**
1. Wrap both in single Cloud Function
2. Implement async queue + admin retry panel
3. Accept eventual consistency with monitoring

---

### 13. 🟡 Incomplete Error Message Context in coinService

**Severity:** MEDIUM  
**File:** `src/services/coinService.ts` (multiple throw statements)  
**Impact:** Generic error messages make debugging harder

**Example:**
```typescript
if (balance < coins) throw new Error("INSUFFICIENT_BALANCE");
```

**Better:**
```typescript
throw new Error(`Insufficient balance: need ${coins} NC but have ${balance} NC`);
```

---

## Low-Priority Issues

### 14. 🟢 Excessive Await in Error Context

**Severity:** LOW  
**File:** `src/pages/BookingDetail.tsx:72-75`  
**Impact:** Unnecessary async in error path

**Code:**
```typescript
const alreadyRated = await hasResidentReview(id, user.uid).catch((err) => {
  console.error("Error checking resident review status:", err);
  return true; // Safe default
});
```

**Note:** This is handled correctly with safe default. Consider removing console.error per no-console-log rule.

---

### 15. 🟢 Potential Race in Notification State

**Severity:** LOW  
**File:** `src/hooks/useNotifications.ts`  
**Impact:** Multiple localStorage reads could race

**Code:**
```typescript
const raw = localStorage.getItem(readKey(uid));
const raw = localStorage.getItem(clearedKey(uid));
```

**Note:** Low severity since notifications are not critical. Consider using a single serialized object.

---

### 16. 🟢 Service Category Hardcoding

**Severity:** LOW  
**File:** `firestore.rules:227` and `src/constants/serviceCatalog.ts`  
**Impact:** Category list duplicated in two places

**Suggestion:** Move to `config/platformSettings` like subscription plans.

---

## Summary Table

| # | Issue | Severity | File | Status |
|---|-------|----------|------|--------|
| 1 | `any` type in service layer | CRITICAL | serviceService.ts | Open |
| 2 | `any` type in catch block | CRITICAL | Profile.tsx | Open |
| 3 | `Record<string, any>` in component | CRITICAL | BookingFlow.tsx | Open |
| 4 | coinService.ts exceeds 800 lines | CRITICAL | coinService.ts | Open |
| 5 | Unsafe Math.random for IDs | CRITICAL | supportService.ts | Open |
| 6 | console.log in production | HIGH | notificationService.ts | Open |
| 7 | Silent error catches | HIGH | Multiple | Open |
| 8 | Fire-and-forget rewardReferral | HIGH | BookingDetail.tsx | Open |
| 9 | Phone validation UX | HIGH | Profile.tsx | Open |
| 10 | Firestore rules null checks | HIGH | firestore.rules | Open |
| 11 | Null checks in booking | MEDIUM | BookingDetail.tsx | Open |
| 12 | AdminBroadcast HTML handling | MEDIUM | AdminBroadcast.tsx | Mitigated |
| 13 | Generic error messages | MEDIUM | coinService.ts | Open |
| 14 | Excessive await in error | LOW | BookingDetail.tsx | Open |
| 15 | Notification state race | LOW | useNotifications.ts | Open |
| 16 | Hardcoded categories | LOW | Multiple | Open |

---

## Verified as Fixed (from BUGS.md)

✅ Bug #1: Duplicate `cancelBookingAndRefund` — FIXED  
✅ Bug #3: Timezone bug in rebook — FIXED  
✅ Bug #4: platformFeePct default — FIXED  
✅ Bug #6: Past date pre-fill — FIXED  
✅ Bug #7: Orphaned Cloudinary files — FIXED  
✅ Bug #8: Variable shadowing — FIXED  
✅ Bug #9: No-op useMemo — FIXED  

**Still Open:**  
⚠️ Bug #2: Shared ledger key (design, not defect)  
⚠️ Bug #5: rewardReferral atomic failure (design issue, partially mitigated)  
⚠️ Bug #10: cashableBalance dead code (in unused function)  

---

## Recommendations

### Immediate (This Sprint)

1. **Convert all `any` → `unknown` + type guards** (Issues #1, #2, #3)
2. **Remove console.log from production** (Issue #6)
3. **Fix unsafe random generation** (Issue #5)
4. **Add error logging to all catch blocks** (Issue #7)
5. **Refactor coinService.ts** (Issue #4)

### Near-term (Next Sprint)

6. Strengthen Firestore rule null checks (Issue #10)
7. Implement referral reward retry queue (Issue #8)
8. Add null checks to booking validation (Issue #11)
9. Improve error message context (Issue #13)

### Ongoing

10. Monitor notification state race (Issue #15)
11. Consolidate service categories (Issue #16)

---

## Security Assessment

**Overall:** ⚠️ **Good with improvements needed**

**Strengths:**
- ✅ DOMPurify in use for HTML content
- ✅ Firestore rules enforce role-based access
- ✅ Transactional patterns hardened for race conditions
- ✅ Idempotency keys prevent double-spending
- ✅ No hardcoded secrets found
- ✅ Input validation at boundaries (Zod)

**Weaknesses:**
- ❌ Type safety gaps allow silent errors
- ❌ Missing error context in logs
- ❌ Weak subscription validation in rules
- ❌ Unsafe ID generation for tickets

**Action:** Address CRITICAL issues before next production deployment.

---

## Code Quality Metrics

- **TypeScript strict mode:** ✅ Enabled
- **ESLint:** Coverage TBD
- **Test coverage:** 80% target, gaps in AdminPanel
- **Code organization:** ⚠️ coinService exceeds recommended size
- **Error handling:** ⚠️ Inconsistent logging
- **Documentation:** ✅ CLAUDE.md comprehensive

---

## Next Steps

1. Triage issues by team priority
2. Create GitHub issues for each finding
3. Assign Epic for type safety conversion
4. Schedule coinService refactoring
5. Re-audit after fixes implemented
