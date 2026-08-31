# ProNeighbor — Comprehensive Code Audit Report

**Audit Date:** August 29, 2026  
**Auditor:** Automated Code Audit  
**Scope:** Full line-by-line review of `src/`, `functions/`, `public/`, and configuration files  
**Focus:** Functional logic errors, technical bugs, security vulnerabilities, and edge cases

---

## Executive Summary

The ProNeighbor codebase is a well-structured React + Firebase application with a NeighbourCoins wallet, booking system, and admin panel. The code demonstrates strong security patterns (Firestore rules, transactional writes, escrow system) and good engineering practices (idempotency guards, Sentry error tracking, Zod validation). However, the audit uncovered **26 issues** across 4 categories, including 3 high-severity security vulnerabilities and 6 functional logic errors that could cause data corruption or financial inconsistencies.

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security Vulnerabilities | 1 | 2 | 1 | 0 |
| Functional Logic Errors | 0 | 3 | 3 | 2 |
| Technical Bugs | 0 | 1 | 3 | 2 |
| Edge Cases | 0 | 1 | 3 | 2 |

---

## 1. Security Vulnerabilities

### 🔴 CRITICAL: Cloud Function admin check uses Firestore document field instead of JWT claim

**File:** `functions/src/subscriptions.ts` — `adminSubscriptionAction`  
**Severity:** Critical  
**Impact:** Admin privilege escalation if Firestore `role` field is manipulated

```typescript
// CURRENT (vulnerable) — checks Firestore document field
const adminSnap = await db.collection("users").doc(callerUid).get();
if (!adminSnap.exists || adminSnap.data()?.role !== "admin") {
  throw new functions.HttpsError("permission-denied", "Admin only.");
}
```

**Problem:** The Firestore `role` field is writable by admins via `updateUserProfile`. A compromised admin session or a Firestore rule oversight could allow a non-admin to set their own role. The Firestore security rules correctly use `request.auth.token.admin` (a custom JWT claim set via Admin SDK), but the Cloud Function doesn't.

**Fix:** Use the JWT custom claim:
```typescript
if (!request.auth?.token?.admin) {
  throw new functions.HttpsError("permission-denied", "Admin only.");
}
```

---

### 🟠 HIGH: TOCTOU race condition in subscribeWithNCCallable

**File:** `functions/src/subscriptions.ts` — `subscribeWithNCCallable`  
**Severity:** High  
**Impact:** Users could bypass active-subscription guard and subscribe multiple times concurrently

```typescript
// This query inside runTransaction is NOT part of the transaction read set
const existingSnap = await db
  .collection("subscriptions")
  .where("uid", "==", uid)
  .where("status", "not-in", ["expired", "cancelled"])
  .limit(1)
  .get();  // ← NOT tx.get()!
```

**Problem:** The same TOCTOU (Time-of-Check-Time-of-Use) bug that was already fixed in `requestPayout` (Fix #1). `db.collection(...).get()` inside `db.runTransaction()` does NOT participate in Firestore's conflict detection. Two concurrent subscription requests could both pass the active-sub check before either writes.

**Fix:** Use `tx.get()` with a deterministic document ID (e.g., `sub_${uid}_active`) or restructure to use the user document's `subscription` denormalized field.

---

### 🟠 HIGH: Hardcoded Firebase config in service worker

**File:** `public/sw.js` — Lines 8-15  
**Severity:** High (Maintenance/Leak risk)

```javascript
firebase.initializeApp({
  apiKey: "AIzaSyDLa5-OsjK3iSTfWar4kKfRPJl9_fu8Pk0",
  authDomain: "neighbhorpro.firebaseapp.com",
  projectId: "neighbhorpro",
  // ... full config hardcoded
});
```

**Problem:** Firebase config is hardcoded in the service worker instead of reading from environment variables or a build-time config. This creates maintenance friction (config changes require code edits) and could accidentally expose project identifiers if the file is ever copied to another context.

**Fix:** Use Vite's `import.meta.env` at build time to inject the config into the service worker, or fetch it from a known endpoint at SW activation time.

---

### 🟡 MEDIUM: Public profiles readable without authentication

**File:** `firestore.rules` — `publicProfiles` collection  
**Severity:** Medium

```
match /publicProfiles/{userId} {
  allow list:   if true;
  allow read:   if true;  // No auth required
}
```

**Problem:** The `publicProfiles` collection is readable by unauthenticated users. While this is by design for the Browse page, any sensitive field accidentally included in the `mirrorPublicProfile` writes would be publicly exposed. The current `PUBLIC_PROFILE_FIELDS` allowlist in `userService.ts` is comprehensive, but there's no automated test preventing future fields from leaking.

**Fix:** Add a Firestore rule assertion or automated test that validates the `publicProfiles` schema against the allowlist.

---

## 2. Functional Logic Errors

### 🟠 HIGH: DST-unsafe date arithmetic in Cloud Functions

**File:** `functions/src/subscriptions.ts` — All date calculations  
**Severity:** High  
**Impact:** Subscription periods could be off by 1 hour around DST transitions

```typescript
// In Cloud Functions (BUGGY):
const periodEnd = new Date(now.getTime() + plan.durationDays * 86_400_000);

// In frontend subscriptionService.ts (FIXED — Fix #2):
const periodEnd = addDaysDSTSafe(now, plan.durationDays);
```

**Problem:** The frontend `subscriptionService.ts` was explicitly fixed (Fix #2) to use DST-safe `setDate()` arithmetic instead of millisecond math. The Cloud Functions still use the buggy millisecond approach. Around DST transitions, subscription periods could be 23 or 25 hours shorter/longer than intended.

**Fix:** Replace `new Date(now.getTime() + days * 86_400_000)` with:
```typescript
function addDaysDSTSafe(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
```

---

### 🟠 HIGH: Escrow refund breaks coinBalance invariant

**File:** `src/services/coinService.ts` — `refundEscrow()` and `cancelBookingAndRefund()`  
**Severity:** High  
**Impact:** `coinBalance ≠ cashableBalance + promoBalance` after refund, blocking future payouts

```typescript
// holdEscrow deducts cashable-first, then promo:
const cashableDeduction = Math.min(clientCashable, coins);
const promoDeduction = coins - cashableDeduction;

// refundEscrow adds back ONLY to cashable:
const newCashable = ((snap.data()?.cashableBalance as number) ?? 0) + escrowCoins;
// promoBalance is NEVER restored!
```

**Problem:** When escrow is held, coins are deducted from `cashableBalance` first, overflowing to `promoBalance`. When refunded, all coins go back to `cashableBalance`, breaking the invariant `coinBalance = cashableBalance + promoBalance`. Example:
- Start: coin=300, cashable=100, promo=200
- Hold 250: cashable=0, promo=50, coin=50 ✓ (50 = 0 + 50)
- Refund 250: cashable=250, promo=50, coin=300 ✗ (300 ≠ 250 + 50)

This causes `requestPayout` to check `cashableBalance < coins` incorrectly.

**Fix:** Refund should mirror the original deduction. Store the deduction breakdown in the booking document (`escrowCashableDeduction`, `escrowPromoDeduction`) and restore accordingly:
```typescript
const cashableRefund = Math.min(escrowCoins, data.escrowCashableDeduction ?? escrowCoins);
const promoRefund = escrowCoins - cashableRefund;
```

---

### 🟠 HIGH: earn_profile fires on every snapshot update

**File:** `src/contexts/AuthContext.tsx` — `useEffect` with `onSnapshot`  
**Severity:** High (Performance/Contention)

```typescript
const unsub = onSnapshot(doc(db, "users", user.uid), snap => {
  // ...
  if (isProfileComplete(data)) {
    earnCoins(user.uid, "earn_profile", user.uid).catch(/*...*/);
  }
});
```

**Problem:** `earn_profile` is called on EVERY snapshot update (every document change) for users with complete profiles. While the transaction has an idempotency guard (`existing.exists()`), this means every profile field edit (bio, skills, photo) triggers a Firestore transaction read on the `earn_profile` ledger entry. This creates unnecessary read costs and contention on the ledger document.

**Fix:** Track whether the profile was previously complete using a ref, and only call `earnCoins` on the transition from incomplete → complete:
```typescript
const wasCompleteRef = useRef(false);
// Inside onSnapshot:
const isComplete = isProfileComplete(data);
if (isComplete && !wasCompleteRef.current) {
  earnCoins(user.uid, "earn_profile", user.uid);
}
wasCompleteRef.current = isComplete;
```

---

### 🟡 MEDIUM: Commission rate default mismatch between BookingFlow and releaseEscrow

**File:** `src/pages/BookingFlow.tsx` and `src/services/coinService.ts`  
**Severity:** Medium  
**Impact:** Platform fee inconsistency when platformSettings.commissionRate is not configured

```typescript
// BookingFlow.tsx: defaults to 10
const [commissionRate, setCommissionRate] = useState(10);

// releaseEscrow in coinService.ts: defaults to 0.15 (15%)
export async function releaseEscrow(..., platformFeePct = 0.15)
```

**Problem:** If `getPlatformSettings()` fails or returns no `commissionRate`, BookingFlow uses 10% but `releaseEscrow` uses 15%. The booking document stores `commissionRate` from the booking flow, and `releaseEscrow` reads it from the booking, so this is only an issue for bookings created without a stored rate (legacy data). But the inconsistency is a maintenance risk.

**Fix:** Use a single source of truth. Define `DEFAULT_COMMISSION_RATE = 15` in a shared constants file and use it in both places.

---

### 🟡 MEDIUM: Admin subscription grant uses month-based ID (known bug reintroduced)

**File:** `src/pages/admin/AdminUsers.tsx` — `handleGrantSubscription`  
**Severity:** Medium

```typescript
const monthKey = now.toISOString().slice(0, 7).replace("-", "");
const subId = `sub_${uid}_${monthKey}`;
```

**Problem:** This is the exact bug that was fixed as BUG #4 in `subscriptionService.ts` (changed to timestamp-based ID). The admin grant function still uses the month-based ID, causing collisions when multiple comp grants happen in the same month.

**Fix:** Use timestamp-based ID: `const subId = \`sub_${uid}_${now.getTime()}\`;`

---

### 🟡 MEDIUM: Booking dedup blocks rebooking after cancellation

**File:** `src/services/bookingService.ts` — `createBooking`  
**Severity:** Medium

```typescript
const dedupKey = `${clientId}_${proId}_${date}_${timeSlot}_${serviceName}`;
// Dedup doc is never deleted when booking is cancelled
```

**Problem:** The dedup document persists even after a booking is cancelled. A user who cancels a booking cannot create a new booking for the same pro/date/time/service combination, which is a legitimate use case (e.g., rescheduling to a different service).

**Fix:** Either delete the dedup document when the booking is cancelled, or add `status: "cancelled"` to the dedup doc and check it in `createBooking`.

---

### 🟢 LOW: CSV export doesn't escape special characters

**File:** `src/pages/admin/AdminUsers.tsx` — `exportUsers`  
**Severity:** Low

```typescript
const csv = ["Name,Email,Society,Role,Pro,Status"]
  .concat(users.map((u: UserRow) => `"${u.displayName}","${u.email}",...`))
```

**Problem:** If a user's `displayName` contains a double quote (`"`), comma, or newline, the CSV will be malformed.

**Fix:** Escape double quotes by doubling them: `name.replace(/"/g, '""')`

---

### 🟢 LOW: `listenForForegroundMessages` cleanup race

**File:** `src/services/notificationService.ts`  
**Severity:** Low

```typescript
export function listenForForegroundMessages(onNotification?) {
  let unsub: (() => void) | null = null;
  getMessagingInstance().then(messaging => {
    if (!messaging) return;
    unsub = onMessage(messaging, payload => { /* ... */ });
  });
  return () => { if (unsub) unsub(); };
}
```

**Problem:** The cleanup function is returned synchronously, but `unsub` is set asynchronously inside `.then()`. If the component unmounts before `getMessagingInstance()` resolves, the cleanup runs with `unsub === null` and the listener is never removed.

**Fix:** Return a cleanup that sets a flag to prevent registration if already unmounted.

---

## 3. Technical Bugs

### 🟠 HIGH: Double ErrorBoundary wrapping

**File:** `src/App.tsx` and `src/main.tsx`  
**Severity:** High (Confusing error handling)

```tsx
// main.tsx
<ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
</ErrorBoundary>

// App.tsx
<ErrorBoundary>
  <BrowserRouter>
    <AuthProvider>...</AuthProvider>
  </BrowserRouter>
</ErrorBoundary>
```

**Problem:** Two `ErrorBoundary` components wrap the application. The inner one catches React rendering errors within the app tree, while the outer one catches errors in `QueryClientProvider` initialization. This is intentional but creates confusion: an error in `AuthProvider` could be caught by either boundary depending on timing, and the outer boundary's fallback UI may not match the app's layout.

**Fix:** Remove the inner `ErrorBoundary` from `App.tsx` since the outer one in `main.tsx` already provides full coverage. Or make the inner boundary only wrap specific risky subtrees.

---

### 🟡 MEDIUM: Service worker cache version hardcoded

**File:** `public/sw.js`  
**Severity:** Medium

```javascript
const CACHE_NAME = 'proneighbor-v3-20260525';
```

**Problem:** The cache version is hardcoded with a date stamp. When new assets are deployed, old caches won't be invalidated unless the developer remembers to update this string. Stale cached assets could break the app.

**Fix:** Use a build-time variable (e.g., `import.meta.env.VITE_CACHE_VERSION`) injected by Vite during the build process.

---

### 🟡 MEDIUM: Firestore `!=` query requires composite index

**File:** `src/services/messageService.ts` — `getUnreadCount`  
**Severity:** Medium

```typescript
const snap = await getDocs(
  query(collection(db, `messages/${convId}/chats`), where("senderId", "!=", uid))
);
```

**Problem:** Firestore `!=` queries require a composite index. If the index is missing from `firestore.indexes.json`, this query will throw a `FAILED_PRECONDITION` error. The error is caught silently (returns `snap.size` which would be 0), causing unread counts to always show 0.

**Fix:** Add the required index to `firestore.indexes.json` or restructure the query to use `not-in` with the other participant's UID.

---

### 🟡 MEDIUM: `onReviewWrite` trigger counts all documents including non-rating fields

**File:** `functions/src/index.ts` — `onReviewWrite`  
**Severity:** Medium

```typescript
const snap = await db.collection('reviews')
  .where('proId', '==', proId)
  .get();

const ratings = snap.docs
  .map(d => Number(d.data().rating))
  .filter(r => Number.isFinite(r) && r >= 1 && r <= 5);
```

**Problem:** The trigger fires on every create/update/delete in the `reviews` collection. If a review document is updated (e.g., admin edits a comment), the trigger recalculates the aggregate by scanning ALL reviews for the pro. For pros with many reviews, this could be slow. Additionally, if a review document has non-numeric rating data (data corruption), `Number(d.data().rating)` could produce `NaN` which is filtered out, but `snap.size` (used for `reviewCount`) still counts the corrupt document.

**Fix:** Use `validRatings.length` for `reviewCount` instead of `snap.size` to ensure only valid reviews are counted.

---

### 🟢 LOW: PWAWrapper renders inside AuthProvider but before Layout

**File:** `src/App.tsx`  
**Severity:** Low

```tsx
<Route element={<Layout />}>
  {/* protected routes */}
</Route>
<PWAWrapper />  {/* Rendered outside Layout */}
```

**Problem:** `PWAWrapper` is rendered inside `AuthProvider` and `BrowserRouter`, but outside `Layout`. This means the PWA install banner appears on top of the full page without the app's layout shell, which could cause visual overlap with the sidebar or topbar.

**Fix:** Move `PWAWrapper` inside the `Layout` route element, or ensure its CSS z-index and positioning account for the layout chrome.

---

### 🟢 LOW: `generateTicketNumber` race condition

**File:** `src/services/supportService.ts`  
**Severity:** Low

```typescript
const snap = await getDocs(query(
  collection(db, "tickets"),
  where("createdAt", ">=", Timestamp.fromDate(startOfDay)),
  where("createdAt", "<", Timestamp.fromDate(endOfDay))
));
const seq = String(snap.size + 1).padStart(3, "0");
```

**Problem:** Two tickets created concurrently could get the same sequence number. The fallback uses `crypto.getRandomValues()` which avoids this but produces non-sequential numbers.

**Fix:** Use a Firestore counter document with `runTransaction` for atomic increment.

---

## 4. Edge Cases

### 🟠 HIGH: Payout cancellation races with admin processing

**File:** `src/services/coinService.ts` — `cancelPayoutRequest`  
**Severity:** High  
**Impact:** Double-spending — coins refunded to user AND admin marks payout as processed

```typescript
// User cancels payout (transaction A):
tx.update(payoutRef, { status: "cancelled_by_user" });
tx.update(userRef, { coinBalance: refundedBalance, cashableBalance: refundedCashable });

// Admin processes payout (transaction B, running concurrently):
// Reads payout before status is "cancelled_by_user"
tx.update(payoutRef, { status: "processed" });
```

**Problem:** If a user cancels a payout while an admin is concurrently processing it, the user's coins are refunded AND the payout is marked as processed. There's no lock or status check in `updatePayoutStatus` to prevent processing a payout that was just cancelled.

**Fix:** In `updatePayoutStatus`, use a transaction that checks `payout.status === "pending"` before updating:
```typescript
await runTransaction(db, async tx => {
  const snap = await tx.get(payoutRef);
  if (snap.data()?.status !== "pending") throw new Error("PAYOUT_NOT_PENDING");
  tx.update(payoutRef, { status, processedBy: adminUid, processedAt: serverTimestamp() });
});
```

---

### 🟡 MEDIUM: Zero-escrow bookings bypass balance check

**File:** `src/services/bookingService.ts` — `createBooking`  
**Severity:** Medium

```typescript
if (escrowCoins > 0) {
  // Balance check and deduction
} else {
  tx.set(bookingRef, bookingDoc); // No balance check
}
```

**Problem:** Bookings with `escrowCoins === 0` (free consultations, quote-based) skip the balance check entirely. A user with 0 NC can create unlimited free bookings. While this may be intentional, it could be exploited to spam professionals with booking requests.

**Fix:** Add a rate limit on zero-escrow bookings (e.g., max 5 per day per user).

---

### 🟡 MEDIUM: Message read count query doesn't handle missing `lastReadAt`

**File:** `src/services/messageService.ts` — `getUnreadCount`  
**Severity:** Medium

```typescript
if (!lastRead) {
  const snap = await getDocs(
    query(collection(db, `messages/${convId}/chats`), where("senderId", "!=", uid))
  );
  return snap.size;
}
```

**Problem:** When a user has never read a conversation, ALL messages from the other participant are counted as unread. For active conversations, this could return hundreds of unread messages, causing a Firestore quota hit. The query also lacks a `limit()`, so it fetches ALL messages.

**Fix:** Add a `limit(100)` to the query and display "99+" for large counts.

---

### 🟡 MEDIUM: Cloudinary upload for residency proof uses "image" resource type for PDFs

**File:** `src/services/userService.ts` — `uploadResidencyProof`  
**Severity:** Medium

```typescript
const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
const resourceTypeToUse: "image" | "raw" | "auto" = isPdf ? "image" : "auto";
```

**Problem:** PDFs are uploaded with `resourceType: "image"`. While Cloudinary can handle this, it forces PDFs through image processing pipelines, which could fail for encrypted or password-protected PDFs. The URL normalization (`getPdfPreviewUrl`) then tries to convert the PDF to a JPG preview using `pg_1`, which may fail for multi-page or complex PDFs.

**Fix:** Use `resourceType: "raw"` for PDFs and generate previews server-side or using Cloudinary's PDF-to-image transformation with error handling.

---

### 🟢 LOW: Profile creation fallback can create duplicate referral codes

**File:** `src/contexts/AuthContext.tsx` — `createUserProfile`  
**Severity:** Low

```typescript
// Transaction fails → fallback to non-transactional create
const referralCode = await generateUniqueReferralCode({...});
await setDoc(ref, profile);
await setDoc(doc(db, "referralCodes", referralCode), {...}, { merge: true });
```

**Problem:** If the transaction fails and falls back to non-transactional creates, two concurrent signups could generate the same referral code (since `generateUniqueReferralCode` is deterministic and doesn't check for collisions). The `{ merge: true }` would silently overwrite the first referral code's UID.

**Fix:** Add a collision check or use a random suffix for the fallback path.

---

### 🟢 LOW: Admin user creation doesn't set coinBalance or referralCode

**File:** `src/pages/admin/AdminUsers.tsx` — `AddUserModal`  
**Severity:** Low

```typescript
const profileData = {
  uid, displayName: form.displayName.trim(), email: form.email.trim(),
  society: form.society.trim(), role: form.role, isServiceProvider: form.isServiceProvider,
  photoURL: "", bio: "", skills: [], hourlyRate: 0, isFreeConsultation: true,
  rating: 0, reviewCount: 0, disabled: false, createdAt: serverTimestamp(),
  residentVerificationStatus: "none",
  // Missing: coinBalance, cashableBalance, promoBalance, referralCode
};
```

**Problem:** Admin-created users are missing `coinBalance`, `cashableBalance`, `promoBalance`, and `referralCode`. The Firestore rules require `coinBalance` to be a non-negative integer for wallet operations. Missing these fields could cause `NaN` errors in wallet calculations or prevent the user from earning signup bonus.

**Fix:** Add the missing fields:
```typescript
coinBalance: 0, cashableBalance: 0, promoBalance: 0,
emailVerified: false, emailVisible: false, phoneVisible: false, flatVisible: false,
```

---

## Recommendations

### Immediate Actions (Fix within 1 week)
1. **Fix Cloud Function admin check** to use JWT claims instead of Firestore document fields
2. **Fix escrow refund logic** to restore coins to the original buckets (cashable/promo)
3. **Fix DST-unsafe date math** in Cloud Functions
4. **Fix TOCTOU in subscribeWithNCCallable** to use transactional reads

### Short-term (Fix within 1 month)
5. **Add payout processing transaction guard** to prevent concurrent cancel/process race
6. **Fix earn_profile firing** on every snapshot update
7. **Fix admin subscription grant ID** to use timestamp instead of month key
8. **Move Firebase config** out of service worker hardcoded values
9. **Add Firestore index** for `messages/{convId}/chats` senderId != query

### Long-term (Next quarter)
10. **Implement automated schema validation** for `publicProfiles` to prevent field leakage
11. **Add rate limiting** for zero-escrow bookings
12. **Build-time cache versioning** for the service worker
13. **Add integration tests** for the coin economy invariant (`coinBalance = cashableBalance + promoBalance`)

---

## Appendix: Files Reviewed

### Core Application (`src/`)
- `App.tsx`, `main.tsx`, `firebase.ts`
- `contexts/AuthContext.tsx`
- `services/coinService.ts`, `bookingService.ts`, `subscriptionService.ts`
- `services/userService.ts`, `messageService.ts`, `reviewService.ts`
- `services/notificationService.ts`, `supportService.ts`, `razorpayService.ts`
- `services/_shared.ts`, `firestoreService.ts`
- `pages/Wallet.tsx`, `BookingFlow.tsx`
- `pages/admin/AdminUsers.tsx`
- `components/auth/ProtectedRoute.tsx`, `AuthPages.tsx`, `EmailVerifiedPage.tsx`
- `hooks/usePushNotifications.ts`
- `lib/validation.ts`, `queryClient.ts`, `sentry.ts`
- `utils/cloudinary.ts`

### Backend (`functions/`)
- `src/index.ts`, `src/subscriptions.ts`

### Infrastructure
- `firestore.rules`
- `public/sw.js`

---

*Report generated automatically. All findings are based on static code analysis and should be verified with runtime testing before implementing fixes.*
