# ProNeighbor UAT Blockers — Quick Fix Summary

**6 Critical Blockers | 4 High Priority | 5 Medium Priority**

---

## 🔴 BLOCKERS — Fix These First (4 Hours Max)

### B1 | AdminWallet Payout Lock Not Cleared
**File:** `src/pages/admin/AdminWallet.tsx` line ~270  
**Change:** Replace `updatePayoutStatus()` → `adminFinalizePayoutStatus()`  
**Why:** Clears sentinel so pro can request new payouts after settling one

```ts
// BEFORE:
await updatePayoutStatus(payoutId, status, adminUid);

// AFTER:
await adminFinalizePayoutStatus(payoutId, status, adminUid);
```

---

### B2 | subscribeWithNC Double-Subscribe Bug
**File:** `src/services/subscriptionService.ts` lines ~215–230  
**Change:** Check correct idempotency doc  
**Why:** Prevents pro from subscribing twice in same month

```ts
// BEFORE (checks phantom doc):
const activeSubId = `sub_${uid}_active`;
const activeSubRef = doc(db, "subscriptions", activeSubId);
const existingSubSnap = await tx.get(activeSubRef);

// AFTER (checks actual sub doc):
const existingSubSnap = await tx.get(doc(db, "subscriptions", subId));
if (existingSubSnap.exists()) {
  const existingSub = existingSubSnap.data() as Subscription;
  const end = toDate(existingSub.currentPeriodEnd);
  if (end && end > new Date()) {
    throw new Error("ACTIVE_SUB_EXISTS");
  }
}
```

---

### B3 | activateTrial TOCTOU Race Condition
**File:** `src/services/subscriptionService.ts` lines ~165–180  
**Change:** Use transactional `tx.get()` instead of `getDocs()`  
**Why:** Prevents two concurrent trial activations from both succeeding

```ts
// BEFORE (non-transactional query):
const activeSubSnap = await getDocs(query(
  collection(db, "subscriptions"),
  where("uid", "==", uid),
  where("status", "not-in", ["expired", "cancelled"]),
  limit(1)
));

// AFTER (transactional doc read):
const trialSubId = `sub_${uid}_trial`;
const trialSubRef = doc(db, "subscriptions", trialSubId);
const trialSubSnap = await tx.get(trialSubRef);

if (trialSubSnap.exists()) {
  const existingSub = trialSubSnap.data() as Subscription;
  const end = toDate(existingSub.currentPeriodEnd);
  if (end && end > new Date()) {
    throw new Error("ACTIVE_SUB_EXISTS");
  }
}
```

---

### B4 | Messages Emoji Picker Trap on Mobile
**File:** `src/pages/Messages.tsx` line ~55  
**Change:** Add outside-click handler + stopPropagation  
**Why:** Users can dismiss emoji picker on mobile

```ts
// ADD useEffect after line 55:
useEffect(() => {
  if (!showEmojiPicker) return;

  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") && target.closest("button")?.innerHTML.includes("😀")) {
      return;
    }
    setShowEmojiPicker(false);
  };

  document.addEventListener("click", handleClickOutside);
  return () => document.removeEventListener("click", handleClickOutside);
}, [showEmojiPicker]);

// ALSO at emoji picker render (~line 355):
{showEmojiPicker && (
  <div 
    style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: 8, zIndex: 10 }}
    onClick={(e) => e.stopPropagation()}
  >
    <EmojiPicker onEmojiClick={onEmojiClick} />
  </div>
)}
```

---

### B5 | Wallet Payout: Missing Min/Max Validation
**File:** `src/pages/Wallet.tsx` line ~340  
**Change:** Add guards before `setPayoutRequest()`  
**Why:** Users see friendly errors, not generic transaction failure

```ts
// BEFORE:
const handlePayout = async () => {
  if (!user || !userProfile) return;
  if (pendingPayout) { ... }
  const coins = parseInt(payoutCoins, 10);
  const normalizedUpiId = upiId.trim();
  if (!coins || isNaN(coins)) { ... }
  if (!normalizedUpiId.includes("@")) { ... }
  setPayoutRequest({ coins, upiId: normalizedUpiId });
  setShowPayoutConfirm(true);
};

// AFTER:
const handlePayout = async () => {
  if (!user || !userProfile) return;
  if (pendingPayout) { ... }
  const coins = parseInt(payoutCoins, 10);
  const normalizedUpiId = upiId.trim();
  if (!coins || isNaN(coins)) { ... }
  if (coins < MIN_PAYOUT_COINS) { 
    setPayoutMsg({ type: "error", text: `Minimum payout is ${MIN_PAYOUT_COINS} NC.` }); 
    return; 
  }
  if (coins > cashableBalance) { 
    setPayoutMsg({ type: "error", text: `Insufficient balance: you have ${cashableBalance} NC.` }); 
    return; 
  }
  if (!normalizedUpiId.includes("@")) { ... }
  setPayoutRequest({ coins, upiId: normalizedUpiId });
  setShowPayoutConfirm(true);
};
```

---

### B6 | subscribeWithNC: Stale Balance After Purchase
**File:** `src/services/subscriptionService.ts` line ~305  
**Change:** Update `coinBalance` alongside `cashableBalance`  
**Why:** Wallet shows correct balance immediately without refresh

```ts
// BEFORE:
const newCashable = cashableBalance - price;
tx.update(userRef, {
  cashableBalance: newCashable,
  subscription: { ... },
  updatedAt: serverTimestamp(),
});

// AFTER:
const newCashable = cashableBalance - price;
const newCoinBal = Math.max(0, (userData.coinBalance as number ?? 0) - price);

tx.update(userRef, {
  coinBalance: newCoinBal,
  cashableBalance: newCashable,
  subscription: { ... },
  updatedAt: serverTimestamp(),
});
```

---

## 🟡 HIGH PRIORITY — Next 2 Hours

### H1 | Unsafe Math.random() for Ticket IDs
**File:** `src/services/supportService.ts` line ~82

```ts
// BEFORE:
const seq = String(Math.floor(Math.random() * 900) + 100);
return `NP${dateStr}${seq}`;

// AFTER (use crypto):
const randomBytes = new Uint8Array(3);
crypto.getRandomValues(randomBytes);
const hexString = Array.from(randomBytes).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
return `NP${dateStr}_${hexString}`;
```

---

### H3 | Remove console.error from Production
**File:** `src/services/subscriptionService.ts` (4 occurrences)  
**Lines:** ~176, ~330, ~373, ~395

```ts
// BEFORE:
.catch((err: Error) => console.error("Audit log failed:", err));

// AFTER:
.catch((err: unknown) => {
  captureError(err, { operation: "audit_log_subscription_activated", uid });
});
```

---

### H4 | Admin Double-Click Coin Credit Bug
**File:** `src/pages/admin/AdminWallet.tsx` line ~360

```ts
// BEFORE:
const idempotencyKey = `${Date.now()}_${Math.abs(finalAmount)}`;

// AFTER (add UUID package to package.json first):
import { v4 as uuidv4 } from 'uuid';
const idempotencyKey = uuidv4();
```

---

### H5 | Disable Continue While Checking Availability
**File:** `src/pages/BookingFlow.tsx` line ~365

```tsx
// BEFORE:
<button className="btn btn-primary btn-lg" ... onClick={() => { ... }} >
  Continue
</button>

// AFTER:
<button className="btn btn-primary btn-lg" ... onClick={() => { ... }} disabled={checkingAvail}>
  {checkingAvail ? "Checking availability..." : "Continue"}
</button>
```

---

## 📋 Testing Checklist

```
BLOCKERS (B1–B6):
☐ B1: Admin finalizes payout → pro can request new payout
☐ B2: Subscribe twice in same month → 2nd subscription rejected
☐ B3: Race: 2 tabs trigger trial activation → only 1 succeeds
☐ B4: Mobile emoji picker → closes on outside click
☐ B5: Payout form → rejects <200 NC with friendly error
☐ B6: Subscribe → balance updates without refresh

HIGH PRIORITY (H1–H5):
☐ H1: Generate 1000 ticket IDs → no duplicates
☐ H3: Build → zero console.error statements
☐ H4: Admin clicks button 10x rapidly → coins added only once
☐ H5: Click Continue while availability checking → button disabled

FINAL QA:
☐ All bookings complete successfully
☐ All payouts process without sentinel lock
☐ All subscriptions activate atomically
☐ No stale balances in wallet
☐ No mobile UX traps
```

---

## Time Estimate

| Fix | Estimate | Blocker? |
|-----|----------|----------|
| B1 | 5 min | Yes |
| B2 | 10 min | Yes |
| B3 | 15 min | Yes |
| B4 | 15 min | Yes |
| B5 | 15 min | Yes |
| B6 | 10 min | Yes |
| **Subtotal (Blockers)** | **70 min** | — |
| H1–H5 | 90 min | No |
| M1–M5 | 60 min | No |
| QA Testing | 120 min | — |
| **TOTAL** | **~6h** | — |

---

## Deployment

```bash
# 1. Create fix branch
git checkout -b fix/uat-blockers

# 2. Apply B1–B6 fixes (commit after each fix with atomic commit messages)
git add src/pages/admin/AdminWallet.tsx
git commit -m "fix(B1): Clear payoutLock sentinel in adminFinalizePayoutStatus"

git add src/services/subscriptionService.ts
git commit -m "fix(B2,B3,B6): Fix idempotency, TOCTOU, and balance updates in subscriptionService"

git add src/pages/Wallet.tsx
git commit -m "fix(B5): Add min/max payout validation"

git add src/pages/Messages.tsx
git commit -m "fix(B4): Add outside-click dismiss for emoji picker on mobile"

# 3. Push to staging
git push origin fix/uat-blockers

# 4. Run QA tests on staging
npm run test:e2e

# 5. Tag and merge to main
git tag v1.0.0-uat
git checkout main
git merge --no-ff fix/uat-blockers
git push origin main --tags

# 6. Deploy to prod
npm run build
firebase deploy
```

---

**Created:** 2026-05-25  
**Status:** Ready for Developer Implementation  
**Next Step:** Assign to backend dev, execute B1–B6, then QA sign-off
