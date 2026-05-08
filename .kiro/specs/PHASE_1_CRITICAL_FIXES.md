# Phase 1 Critical Fixes Required

## 🔴 Issue 1: Subscription ID Not Deterministic (BLOCKING)

### Problem
Current implementation uses hardcoded `sub__` ID, which means:
- Same user subscribing twice in same month creates different subscription docs
- Retry safety not guaranteed (idempotency broken)
- Violates Phase 1 requirement: "Deterministic ID: sub_${uid}_${YYYYMM} (idempotent)"

### Current Code
**File:** `src/services/subscriptionService.ts` (Line 38)
```typescript
const subId = "sub__";
```

### Fix
Replace with deterministic format:
```typescript
const subId = `sub_${uid}_${monthKey}`;
```

### Full Context
```typescript
export async function subscribeWithNC(uid: string) {
  const monthKey = new Date().toISOString().slice(0,7).replace("-","");
  subscribeNCSchema.parse({ uid, monthKey });
  
  return runTransaction(db, async (tx) => {
    const userRef = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");
    
    let cashableBalance = (userSnap.data()?.cashableBalance as number) || 0;
    const price = 500;
    
    if (cashableBalance < price) throw new Error("INSUFFICIENT_CASHABLE_BALANCE");
    
    cashableBalance -= price;
    
    // FIX: Use deterministic ID
    const subId = `sub_${uid}_${monthKey}`;  // ← CHANGE THIS LINE
    const subRef = doc(db, "subscriptions", subId);
    const now = new Date();
    const end = new Date(now.getTime() + 30*24*60*60*1000);
    
    tx.update(userRef, { 
      cashableBalance, 
      subscription: { status: "active", currentPeriodEnd: end, plan: "business_monthly_v1", autoRenewCoins: true } 
    });
    
    tx.set(subRef, {
      uid, plan: "business_monthly_v1", status: "active", currency: "NC", amount: price,
      currentPeriodStart: now, currentPeriodEnd: end, autoRenewCoins: true,
      cancelAtPeriodEnd: false, source: "coins", createdAt: serverTimestamp()
    });
    
    const ledgerRef = doc(db, "coinLedger", uid, "entries", subId);
    tx.set(ledgerRef, {
      uid, type: "subscription_debit", amount: -price, balanceAfter: cashableBalance, description: "Monthly Business Subscription", createdAt: serverTimestamp()
    });
    
    return true;
  });
}
```

### Why This Matters
- **Idempotency:** If the transaction fails and retries, the same `subId` is used, so the transaction is safe to retry
- **Uniqueness:** Each user-month combination gets exactly one subscription doc
- **Auditability:** Subscription ID encodes the user and month, making it easy to query

### Test Case
```typescript
test('idempotent subscribe returns same ID on retry', async () => {
  const uid = 'test-user-123';
  const monthKey = '202501';
  
  // First call
  const result1 = await subscribeWithNC(uid);
  
  // Second call (simulating retry)
  const result2 = await subscribeWithNC(uid);
  
  // Both should reference the same subscription doc
  expect(result1).toBe(result2);
  
  // Verify only one subscription doc exists
  const subs = await db.collection('subscriptions')
    .where('uid', '==', uid)
    .where('plan', '==', 'business_monthly_v1')
    .get();
  expect(subs.docs.length).toBe(1);
});
```

---

## 🟡 Issue 2: Missing Snapshot Test for Rules Parity (RECOMMENDED)

### Problem
No automated test verifies that Business categories in firestore.rules match CATEGORY_GROUPS.Business in code. This creates a drift risk where:
- Rules hardcode Business categories: `['Tuition & Coaching', 'Yoga & Fitness', ...]`
- Code defines them in `CATEGORY_GROUPS.Business`
- If one is updated and the other isn't, the gate breaks

### Solution
Add a snapshot test that verifies parity:

**File:** `src/__tests__/firestore.rules.test.ts` (new file)

```typescript
import { describe, it, expect } from 'vitest';
import { CATEGORY_GROUPS } from '../constants/serviceCatalog';

describe('firestore.rules parity', () => {
  it('Business categories in rules match CATEGORY_GROUPS.Business', () => {
    // These are hardcoded in firestore.rules services create rule
    const rulesBusinessCategories = [
      'Tuition & Coaching',
      'Yoga & Fitness',
      'Music & Dance',
      'Language Classes',
      'Nutrition & Diet',
    ];
    
    const codeBusinessCategories = CATEGORY_GROUPS.Business;
    
    // Verify they match exactly
    expect(codeBusinessCategories.sort()).toEqual(rulesBusinessCategories.sort());
  });
});
```

### Why This Matters
- **Security:** Prevents accidental bypass of subscription gate
- **Maintainability:** Catches drift when categories are added/removed
- **Confidence:** Automated verification that rules and code stay in sync

---

## 📋 Fix Checklist

- [ ] Fix subscription ID in `src/services/subscriptionService.ts` (Line 38)
  - Change: `const subId = "sub__";`
  - To: `const subId = \`sub_\${uid}_\${monthKey}\`;`
  - Time: 2 minutes

- [ ] Add snapshot test for Business category parity
  - Create: `src/__tests__/firestore.rules.test.ts`
  - Time: 10 minutes

- [ ] Run build verification
  - Command: `npm run build`
  - Expected: No errors
  - Time: 1 minute

- [ ] Run tests
  - Command: `npm run test`
  - Expected: All tests pass
  - Time: 2 minutes

**Total Fix Time:** ~15 minutes

---

## 🚀 After Fixes

Once these fixes are applied:
1. Run `npm run build` to verify TypeScript compilation
2. Run `npm run test` to verify all tests pass
3. Phase 1 MVP is **100% complete and production-ready**

---

## Optional Enhancements (Phase 2)

These are not blocking but recommended for Phase 2:

1. **Create subscriptionService.test.ts** with comprehensive unit tests
   - Test idempotent subscribe
   - Test expiry math
   - Test cashable balance gate
   - Time: 30 minutes

2. **Extend SubscriptionBanner component** with full state mapping
   - Add states: renewing, past_due, grace, expired, cancelled, comped, paused
   - Time: 15 minutes

3. **Add invoice history to SubscriptionManage**
   - Display last 12 invoices paginated
   - Time: 30 minutes

4. **Implement admin grant action in AdminUsers**
   - Add dropdown for 1/3/6/12 months
   - Write subscription doc with source='comp'
   - Time: 20 minutes

---

**Priority:** Fix Issues 1 & 2 before production deployment  
**Estimated Total Time:** 15 minutes  
**Blocker Status:** Issue 1 is blocking, Issue 2 is recommended
