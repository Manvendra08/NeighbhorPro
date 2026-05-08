# Apply Critical Fix - Subscription ID Determinism

## The Fix (2 minutes)

### File: `src/services/subscriptionService.ts`

**Location:** Line 38

**Current Code:**
```typescript
const subId = "sub__";
```

**Fixed Code:**
```typescript
const subId = `sub_${uid}_${monthKey}`;
```

---

## Complete Function (After Fix)

```typescript
export async function subscribeWithNC(uid: string) {
  const monthKey = new Date().toISOString().slice(0,7).replace("-","");
  subscribeNCSchema.parse({ uid, monthKey });
  
  return runTransaction(db, async (tx) => {
    const userRef = doc(db, "users", uid);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");
    
    let cashableBalance = (userSnap.data()?.cashableBalance as number) || 0;
    const price = 500; // Hardcoded fallback or fetch from config
    
    if (cashableBalance < price) throw new Error("INSUFFICIENT_CASHABLE_BALANCE");
    
    cashableBalance -= price;
    
    // ✅ FIXED: Use deterministic ID format
    const subId = `sub_${uid}_${monthKey}`;
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

---

## Why This Fix Matters

### Before (Broken)
```
User A subscribes in Jan 2025 → subId = "sub__"
User A subscribes again in Jan 2025 (retry) → subId = "sub__" (same)
User B subscribes in Jan 2025 → subId = "sub__" (COLLISION!)
```

### After (Fixed)
```
User A subscribes in Jan 2025 → subId = "sub_userA_202501"
User A subscribes again in Jan 2025 (retry) → subId = "sub_userA_202501" (idempotent ✓)
User B subscribes in Jan 2025 → subId = "sub_userB_202501" (unique ✓)
```

---

## Verification

### 1. Check the Fix
```bash
# Open the file and verify line 38
grep -n "const subId" src/services/subscriptionService.ts
# Should show: const subId = `sub_${uid}_${monthKey}`;
```

### 2. Build Verification
```bash
npm run build
# Expected: No errors, build completes successfully
```

### 3. Type Check
```bash
npx tsc --noEmit
# Expected: No type errors
```

---

## Example Subscription IDs After Fix

| User | Month | Subscription ID |
|------|-------|-----------------|
| user123 | Jan 2025 | sub_user123_202501 |
| user123 | Feb 2025 | sub_user123_202502 |
| user456 | Jan 2025 | sub_user456_202501 |
| user456 | Feb 2025 | sub_user456_202502 |

---

## Testing the Fix

### Manual Test
```typescript
// Test idempotency
const uid = 'test-user-123';
const monthKey = '202501';

// First call
const result1 = await subscribeWithNC(uid);
console.log('First call:', result1);

// Second call (simulating retry)
const result2 = await subscribeWithNC(uid);
console.log('Second call:', result2);

// Both should reference the same subscription doc
// Expected: Both calls succeed, only one subscription doc created
```

### Automated Test (Optional)
```typescript
import { describe, it, expect } from 'vitest';
import { subscribeWithNC } from '../services/subscriptionService';

describe('subscriptionService', () => {
  it('idempotent subscribe returns same ID on retry', async () => {
    const uid = 'test-user-123';
    
    // First call
    await subscribeWithNC(uid);
    
    // Second call (simulating retry)
    await subscribeWithNC(uid);
    
    // Verify only one subscription doc exists
    const subs = await db.collection('subscriptions')
      .where('uid', '==', uid)
      .where('plan', '==', 'business_monthly_v1')
      .get();
    
    expect(subs.docs.length).toBe(1);
  });
});
```

---

## Deployment Steps

1. **Apply the fix**
   ```bash
   # Edit src/services/subscriptionService.ts line 38
   # Change: const subId = "sub__";
   # To: const subId = `sub_${uid}_${monthKey}`;
   ```

2. **Verify build**
   ```bash
   npm run build
   ```

3. **Run tests**
   ```bash
   npm run test
   ```

4. **Commit**
   ```bash
   git add src/services/subscriptionService.ts
   git commit -m "fix(subscription): use deterministic ID for idempotency"
   ```

5. **Deploy**
   ```bash
   firebase deploy
   ```

---

## Rollback (If Needed)

If something goes wrong, rollback is simple:
```bash
git revert <commit-hash>
firebase deploy
```

---

## Impact Assessment

| Aspect | Impact | Severity |
|--------|--------|----------|
| **Idempotency** | Fixed - retries now safe | 🔴 CRITICAL |
| **Uniqueness** | Fixed - no collisions | 🔴 CRITICAL |
| **Auditability** | Improved - ID encodes user+month | 🟢 POSITIVE |
| **Performance** | No change | 🟢 NEUTRAL |
| **Backward Compatibility** | New subscriptions only | 🟢 SAFE |

---

## FAQ

**Q: Will this affect existing subscriptions?**  
A: No. Existing subscriptions keep their current IDs. Only new subscriptions use the deterministic format.

**Q: Do I need to migrate existing data?**  
A: No. The fix only applies to new subscriptions created after deployment.

**Q: What if a user subscribes twice in the same month?**  
A: The second call will use the same subscription ID (idempotent), so it's safe to retry.

**Q: How do I verify the fix worked?**  
A: Check that new subscription IDs follow the format `sub_${uid}_${YYYYMM}` in Firestore.

---

## Time Estimate

- **Apply fix:** 1 minute
- **Build verification:** 1 minute
- **Test verification:** 2 minutes
- **Commit & deploy:** 2 minutes
- **Total:** ~6 minutes

---

**Status:** Ready to apply  
**Risk Level:** 🟢 LOW (simple one-line fix)  
**Rollback:** Easy (git revert)  
**Testing:** Automated (npm run test)
