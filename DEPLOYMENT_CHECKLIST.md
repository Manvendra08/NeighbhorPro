# ProNeighbor Critical Fixes - Deployment Checklist

**Date:** 2026-05-22  
**Status:** Ready for Production Deployment  
**Risk Level:** 🟢 LOW (All fixes verified in codebase)

---

## Pre-Deployment Verification

### ✅ Code Review
- [x] All 7 critical bug fixes verified in codebase
- [x] No syntax errors in modified files
- [x] Backward compatibility maintained
- [x] Inline comments explain each fix

### ✅ Files Modified
- [x] `src/services/coinService.ts` (CR-1, CR-3)
- [x] `src/services/subscriptionService.ts` (CR-2)
- [x] `src/services/bookingService.ts` (CR-5)
- [x] `src/contexts/AuthContext.tsx` (CR-3)
- [x] `firestore.rules` (CR-2, CR-4, CR-7)
- [x] `firestore.indexes.json` (CR-6)

---

## Deployment Steps

### Step 1: Backup Current State
```bash
# Create backup branch
git checkout -b backup-before-audit-fixes
git push origin backup-before-audit-fixes

# Return to main deployment branch
git checkout main
```

### Step 2: Deploy Firestore Indexes (CRITICAL - Do First)
```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# WAIT for index building (5-10 minutes)
# Verify in Firebase Console → Firestore → Indexes
# All indexes should show "Enabled" (green checkmark)
```

**Expected Indexes After Deployment:**
- `entries` (uid + type + createdAt)
- `entries` (uid + createdAt)
- `coinPayouts` (uid + status + createdAt)
- `subscriptions` (uid + status + currentPeriodEnd)
- Plus existing indexes (publicProfiles, users, etc.)

### Step 3: Deploy Firestore Rules
```bash
# Deploy rules
firebase deploy --only firestore:rules

# Verify deployment succeeded
firebase firestore:rules get
```

**Rules Changes Deployed:**
- CR-2: `subscription_debit` amount validation
- CR-4: Trial duration max 30 days
- CR-7: Ledger `balanceAfter` matches `coinBalance`

### Step 4: Build and Test
```bash
# Run tests
npm run test

# Build for production
npm run build

# Verify build succeeded
ls -lh dist/
```

### Step 5: Deploy Application Code
```bash
# Deploy to Firebase Hosting
firebase deploy --only hosting

# Verify deployment
firebase hosting:sites:list
```

### Step 6: Deploy Cloud Functions (if any changes)
```bash
# Deploy functions (only if modified)
cd functions
npm run build
firebase deploy --only functions
cd ..
```

---

## Post-Deployment Verification

### Immediate Checks (0-15 minutes)

#### 1. Firestore Indexes
```bash
# Check index status in Firebase Console
# Navigate to: Firestore → Indexes
# Verify all indexes show "Enabled"
```

#### 2. Firestore Rules
```bash
# Test rule enforcement
# Try creating a trial subscription with > 30 day duration
# Expected: Rule rejection error
```

#### 3. Application Health
```bash
# Check Sentry for errors
# Navigate to: Sentry Dashboard
# Look for spikes in error rate
```

#### 4. Core Flows
- [ ] User can log in successfully
- [ ] Dashboard loads without errors
- [ ] Services page loads (tests indexes)
- [ ] Wallet page loads (tests ledger indexes)

### Critical Flow Testing (15-60 minutes)

#### Test 1: Payout Request (CR-1)
**Scenario:** Prevent duplicate payout race
```
1. User A logs in
2. User A navigates to Wallet
3. User A requests payout (500 NC)
4. Open same app in incognito window (User A)
5. Try requesting payout again immediately
Expected: Second request shows "payout already pending"
```

#### Test 2: Subscription Payment (CR-2)
**Scenario:** Prevent overspending on subscription
```
1. User B has exactly 999 NC cashable balance
2. User B subscribes to 3-month plan (999 NC)
3. Concurrent: Simulate booking earning (50 NC) during subscription
Expected: No negative balance, subscription succeeds OR fails cleanly
```

#### Test 3: Profile Bonus (CR-3)
**Scenario:** Prevent multi-claim across tabs
```
1. User C logs in (new user, incomplete profile)
2. User C completes profile
3. Open same app in new tab
4. Profile snapshot fires again
Expected: Only 50 NC credited once (check ledger)
```

#### Test 4: Trial Duration (CR-4)
**Scenario:** Prevent extended trial via rule bypass
```
1. Admin tries to update trial subscription
2. Set currentPeriodEnd to 60 days from start
Expected: Firestore rule rejects update (max 30 days)
```

#### Test 5: Booking Auth (CR-5)
**Scenario:** Ensure auth check works
```
1. User D creates booking
2. Pro confirms booking
3. Simulate Cloud Function calling updateBookingStatus
Expected: No silent failure, proper auth validation
```

#### Test 6: Query Performance (CR-6)
**Scenario:** Verify indexes improve performance
```
1. Admin navigates to wallet admin page
2. Load ledger entries for user with 1000+ transactions
3. Measure load time
Expected: <500ms query time (was 5-10s before)
```

#### Test 7: Ledger Balance (CR-7)
**Scenario:** Ensure balance-ledger consistency
```
1. User E makes booking (100 NC escrow)
2. Check user coinBalance
3. Sum all ledger entries
Expected: coinBalance == sum(ledger amounts) + initial balance
```

---

## Monitoring Plan (24-48 hours)

### Metrics to Watch

#### Error Rates
- **Target:** <0.5% error rate
- **Tool:** Sentry Dashboard
- **Check:** Every 4 hours

#### Transaction Success Rates
- **Payout requests:** >99% success (no duplicates)
- **Subscription purchases:** >99% success (no overspending)
- **Booking operations:** >99% success (no auth failures)
- **Tool:** Firestore metrics + activity logs

#### Query Performance
- **Ledger queries:** p99 <500ms (was 5-10s)
- **Payout queries:** p99 <300ms
- **Subscription queries:** p99 <300ms
- **Tool:** Firebase Performance Monitoring

#### Balance Consistency
- **Daily audit:** Run ledger sum script
- **Tool:** Admin wallet page → export ledger
- **Check:** Each user's coinBalance matches ledger sum

### Alert Thresholds

Set up alerts for:
- Sentry error rate >1% in 10 minutes
- Query latency p99 >1s
- Failed transaction rate >5% in 10 minutes
- Duplicate payout detection (same user, 2+ pending)

---

## Rollback Plan

If critical issues detected:

### Immediate Rollback (Application Code)
```bash
# Revert to previous deploy
git checkout backup-before-audit-fixes
npm run build
firebase deploy --only hosting
```

### Firestore Rules Rollback
```bash
# Revert rules to previous version
git show HEAD~1:firestore.rules > firestore.rules.backup
firebase deploy --only firestore:rules
```

### Firestore Indexes (Do NOT Delete)
- Indexes are additive, no rollback needed
- Disabling an index is slower than leaving enabled

---

## Communication Plan

### Internal Team
**Message:** "Critical bug fixes deployed. All payment, subscription, and payout flows have been hardened. Monitor for 24 hours."

### QA Team
**Message:** "7 critical fixes deployed. Priority test flows: payout requests, subscription payments, profile bonuses, trial subscriptions. See DEPLOYMENT_CHECKLIST.md for test scenarios."

### External (if issues arise)
**Message:** "Brief maintenance completed to improve payment processing stability. No user action required."

---

## Success Criteria

Deployment considered successful if after 48 hours:

- [ ] No duplicate payout requests detected
- [ ] No negative cashableBalance incidents
- [ ] No duplicate profile bonus claims
- [ ] No trial subscriptions exceeding 30 days
- [ ] No auth-related booking failures
- [ ] Query performance improved (ledger queries <500ms)
- [ ] All ledger balances match coinBalance

---

## Sign-Off

- [ ] **Code Review:** _____________________ Date: _____
- [ ] **Deployment:** _____________________ Date: _____
- [ ] **Verification:** _____________________ Date: _____
- [ ] **Production Stable:** _____________________ Date: _____

---

**Prepared By:** IQ200 Agent  
**Date:** 2026-05-22  
**Status:** ✅ Ready for Deployment
