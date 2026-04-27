# ProNeighbor Bug & Edge Case Report

**Generated:** Auto-generated via static analysis of the codebase  
**Scope:** `src/` directory (React frontend), `functions/` (Firebase backend), and configuration files  
**Severity Legend:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## 🔴 Critical Issues

### 1. Non-Null Assertions (`!`) — 50+ Occurrences
**Risk:** Runtime `TypeError` crashes when values are actually `null`/`undefined`

**Locations:**
- `src/contexts/AuthContext.tsx`: `auth.currentUser.email!` (line ~245)
- `src/pages/BookingFlow.tsx`: `user!.uid`, `proId!`, `pro?.displayName as string`
- `src/pages/BookingDetail.tsx`: `id!`, `booking!.proId as string`
- `src/pages/MyBookings.tsx`: `user!.uid`, `b.serviceName as string`
- `src/pages/ProDetail.tsx`: `id!`, `user!.uid`, `latestBooking.id as string`
- `src/pages/Wallet.tsx`: `payout.id!`, `payout.upiId || ""`
- `src/pages/Messages.tsx`: `bookingId as string`
- `src/pages/Profile.tsx`: `service.id as string`, `service.title as string`

**Impact:** These bypass TypeScript's null checks. If Firebase auth state changes or data is missing, the app will crash with uncaught exceptions.

**Fix:** Replace with runtime null checks:
```typescript
// Instead of:
const credential = EmailAuthProvider.credential(auth.currentUser.email!, password);

// Use:
const email = auth.currentUser?.email;
if (!email) throw new Error("User email not available");
const credential = EmailAuthProvider.credential(email, password);
```

---

### 2. Type Assertions (`as` / `as unknown as`) — 300+ Occurrences
**Risk:** Hidden type mismatches leading to runtime errors

**Locations:**
- `src/contexts/AuthContext.tsx`: `normalizeProfileData({...}) as unknown as UserProfile`
- `src/pages/Profile.tsx`: `(targetProfile.displayName as string)`, `(targetProfile.skills as string[])`
- `src/pages/ProDetail.tsx`: `(pro.displayName as string)`, `(pro.photoURL as string)`
- `src/services/firestoreService.ts`: Multiple Firestore document casts
- `src/components/layout/TopBar.tsx`: `(s.title || (s.name as string)) as string`

**Impact:** Type assertions tell TypeScript to trust the developer. If Firestore schema changes or data is malformed, runtime errors occur that TypeScript could have caught.

**Fix:** Use proper type guards and validation:
```typescript
// Instead of:
const data = snap.data() as UserProfile;

// Use:
const data = snap.data();
if (!isValidUserProfile(data)) throw new Error("Invalid profile data");
```

---

### 3. Silently Swallowed Errors — 15+ Occurrences
**Risk:** Failures go unnoticed, leading to data inconsistency and poor UX

**Locations:**
- `src/contexts/AuthContext.tsx`:
  - `earnCoins(user.uid, "earn_profile", user.uid).catch(() => { profileBonusClaimedRef.current = false; })`
  - `setDoc(doc(db, "referralCodes", referralCode), {...}).catch(() => {})`
  - `mirrorPublicProfile(u.uid, profile).catch(() => {})`
  - `earnCoins(u.uid, "earn_signup_bonus", u.uid).catch(() => {})`
  - `sendEmailVerification(u).catch(() => {})`
- `src/pages/MyBookings.tsx`: `earnCoins(user!.uid, "earn_free_consult", id).catch(() => {})`
- `src/pages/BookingDetail.tsx`: `earnCoins(user!.uid, "earn_free_consult", id!).catch(() => {})`
- `src/pages/ProDetail.tsx`: `computeResponseTime(id).then(setAvgRespHrs)` (no catch)

**Impact:** Critical operations (coin awards, email verification, profile mirroring) can fail silently. Users won't receive expected rewards, and data becomes inconsistent.

**Fix:** At minimum, log errors to Sentry:
```typescript
await earnCoins(uid, "earn_signup_bonus", uid).catch((err) => {
  Sentry.captureException(err, { tags: { operation: "earn_signup_bonus" } });
});
```

---

## 🟠 High Issues

### 4. Unawaited Async Operations (Fire-and-Forget)
**Risk:** Unhandled promise rejections, race conditions

**Locations:**
- `src/contexts/AuthContext.tsx`: `logActivity(cred.user.uid, "user.login", ...)` — not awaited
- `src/contexts/AuthContext.tsx`: `logActivity(u.uid, "user.signup", ...)` — not awaited
- `src/contexts/AuthContext.tsx`: `logActivity(u.uid, "user.login", ...)` — not awaited
- `src/pages/BookingFlow.tsx`: `logActivity(user!.uid, "booking.created", ...)` — not awaited
- `src/pages/BookingDetail.tsx`: `logActivity(user!.uid, "booking.cancelled", ...)` — not awaited
- `src/pages/MyBookings.tsx`: `logActivity(user!.uid, "booking.completed", ...)` — not awaited

**Impact:** If `logActivity` fails, the error becomes an unhandled promise rejection. In strict mode, this can crash Node.js processes.

**Fix:** Always await or explicitly handle:
```typescript
await logActivity(uid, "user.login", "Signed in").catch(err => 
  console.error("Failed to log activity:", err)
);
```

---

### 5. Potential XSS via `dangerouslySetInnerHTML`
**Risk:** Cross-site scripting if sanitization is bypassed

**Locations:**
- `src/components/layout/TopBar.tsx`: `dangerouslySetInnerHTML={{ __html: sanitizeBroadcastHtml(...) }}`
- `src/pages/admin/AdminBroadcast.tsx`: `dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(...) }}`

**Impact:** If `sanitizeBroadcastHtml` or `sanitizeAnnouncementHtml` has vulnerabilities, attackers can inject malicious scripts via broadcast messages.

**Fix:** 
1. Verify DOMPurify is configured with strict settings (removes `on*` event handlers, `javascript:` URLs)
2. Consider using a markdown renderer instead of HTML for broadcasts
3. Add CSP headers to mitigate injected scripts

---

### 6. Race Conditions in State Updates
**Risk:** Stale state, memory leaks, or updates to unmounted components

**Locations:**
- `src/pages/BrowsePros.tsx`: `getAllSocieties().then(res => setSocieties(list))` — no cancellation
- `src/pages/Wallet.tsx`: `getLedger(user.uid).then(r => setLedger(r))` — no cancellation
- `src/pages/Support.tsx`: `getFAQs().then(setFaqs)` — no cancellation
- `src/pages/ProDetail.tsx`: `computeResponseTime(id).then(setAvgRespHrs)` — no cancellation
- `src/components/dashboard/RecommendedPros.tsx`: `getRecommendedPros(uid, ...).then(setPros).catch(() => {})`

**Impact:** If the component unmounts before the promise resolves, React warns about state updates on unmounted components. In rare cases, stale data can overwrite newer data.

**Fix:** Use an `isMounted` flag or AbortController:
```typescript
useEffect(() => {
  let cancelled = false;
  getLedger(user.uid).then(r => {
    if (!cancelled) setLedger(r);
  });
  return () => { cancelled = true; };
}, [user]);
```

---

### 7. Clipboard API Without Error Handling
**Risk:** UX failure on browsers that block clipboard access

**Location:**
- `src/pages/Wallet.tsx`: `navigator.clipboard.writeText(myCode).then(() => { ... })` — no `.catch()`

**Impact:** In Safari or insecure contexts (HTTP), clipboard API throws `NotAllowedError`. The promise rejection is unhandled.

**Fix:**
```typescript
navigator.clipboard.writeText(myCode).then(() => {
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}).catch(() => {
  // Fallback: show the code in a modal for manual copy
  setCopyError("Please copy manually");
});
```

---

## 🟡 Medium Issues

### 8. Timer/Interval Cleanup Issues
**Risk:** Memory leaks, state updates after unmount

**Locations:**
- `src/components/ProAvailabilityEditor.tsx`: `setTimeout(() => setSaved(false), 3000)` — no cleanup
- `src/components/dashboard/FeedComposer.tsx`: `setTimeout(() => { ta.selectionStart = ... }, 0)` — no cleanup
- `src/pages/Contact.tsx`: `setTimeout(() => { setLoading(false); ... }, 1500)` — no cleanup
- `src/pages/Profile.tsx`: `setTimeout(() => setSaved(false), 2500)` — no cleanup
- `src/pages/ProDetail.tsx`: `setTimeout(() => setReportMessage(""), 3000)` — has cleanup ✓
- `src/pages/MyAccount.tsx`: `setTimeout(() => setSaved(false), 2000)` — no cleanup

**Impact:** If the component unmounts before the timeout fires, the callback may reference destroyed DOM nodes or update state on unmounted components.

**Fix:** Always clear timers:
```typescript
useEffect(() => {
  const timer = setTimeout(() => setSaved(false), 3000);
  return () => clearTimeout(timer);
}, []);
```

---

### 9. Potential Memory Leak in `useNotifications.ts`
**Risk:** Intervals may not be cleaned up properly

**Location:**
- `src/hooks/useNotifications.ts`: Sets up `window.setInterval` for polling wallet/admin data

**Impact:** If the hook's cleanup function doesn't clear all intervals, memory leaks occur. The hook also has nested try/catch blocks that may swallow important errors.

**Fix:** Ensure all `setInterval` calls have corresponding `clearInterval` in the cleanup function. Consider using a single interval instead of multiple.

---

### 10. Firebase Configuration Validation Gap
**Risk:** App starts with invalid Firebase config, causing cryptic runtime errors

**Location:**
- `src/firebase.ts`: Checks for placeholder values but doesn't prevent initialization

**Impact:** If a developer forgets to replace `YOUR_API_KEY` placeholders, Firebase initializes with invalid config, leading to confusing auth/database errors.

**Fix:** Throw a clear error during initialization:
```typescript
if (missingVars.length > 0) {
  throw new Error(
    `Firebase config missing: ${missingVars.join(", ")}. ` +
    `Please check your .env.local file.`
  );
}
```

---

### 11. Service Worker Registration Without Error Handling
**Risk:** PWA features fail silently

**Location:**
- `src/main.tsx`: `navigator.serviceWorker.register("/sw.js").catch((err) => { console.warn("SW registration failed:", err); })`

**Impact:** If the service worker fails to register, the app still works but PWA features (offline, push notifications) are silently unavailable.

**Fix:** Consider showing a non-blocking warning to the user if PWA features are critical.

---

## 🟢 Low Issues

### 12. Console Statements in Production Code
**Risk:** Information leakage, performance impact

**Locations:** 17 occurrences across:
- `src/components/ProAvailabilityEditor.tsx`: `console.error("Failed to save availability", e)`
- `src/components/layout/Layout.tsx`: `console.error("Resend error:", err)`
- `src/services/coinService.ts`: `console.warn("Aggregate query failed...")`
- `src/services/auditService.ts`: `console.error("Failed to capture audit event:", error)`
- `src/pages/BrowsePros.tsx`: `console.error("Browse load error:", err)`
- `src/hooks/useDashboardData.ts`: `console.error("Dashboard fetch error:", error)`

**Impact:** Console logs in production can leak sensitive data and slightly impact performance.

**Fix:** Replace with structured logging (Sentry) or strip in production builds.

---

### 13. Potential Division by Zero
**Risk:** `NaN` values in ratings display

**Location:**
- `src/utils/rating.ts`: If `reviewCount` is 0, rating calculations may produce `NaN`

**Impact:** UI displays "NaN" or crashes when rendering ratings for users with no reviews.

**Fix:** Add guards:
```typescript
const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
```

---

### 14. Hardcoded Values
**Risk:** Difficult to maintain, inconsistent behavior

**Locations:**
- `src/contexts/AuthContext.tsx`: `"+91"` country code hardcoded
- `src/lib/validation.ts`: `"+91[6-9]\\d{9}$"` India-specific phone regex
- Multiple admin pages: `setTimeout(() => setToast(null), 3000)` — magic number

**Impact:** If the app needs to support other regions, these hardcoded values require scattered changes.

**Fix:** Extract to constants:
```typescript
export const DEFAULT_COUNTRY_CODE = "+91";
export const TOAST_DURATION_MS = 3000;
```

---

## 📊 Summary by Category

| Category | Count | Severity |
|----------|-------|----------|
| Non-null assertions (`!`) | 50+ | 🔴 Critical |
| Type assertions (`as`) | 300+ | 🔴 Critical |
| Swallowed errors (`.catch(() => {})`) | 15+ | 🔴 Critical |
| Unawaited async operations | 10+ | 🟠 High |
| XSS vectors (`dangerouslySetInnerHTML`) | 8 | 🟠 High |
| Race conditions | 6+ | 🟠 High |
| Timer cleanup issues | 6+ | 🟡 Medium |
| Console statements | 17 | 🟢 Low |

---

## 🛠 Recommended Actions (Priority Order)

1. **Immediate (This Sprint):**
   - Fix all non-null assertions in critical paths (auth, bookings, payments)
   - Add error handling to all `.catch(() => {})` patterns
   - Audit `dangerouslySetInnerHTML` sanitization functions

2. **Short-term (Next 2 Sprints):**
   - Replace type assertions with runtime validation
   - Add cancellation tokens to all async state updates
   - Fix timer cleanup in all components

3. **Long-term (Technical Debt):**
   - Implement strict TypeScript config (`noUncheckedIndexedAccess`, stricter null checks)
   - Add ESLint rules to ban `console.log` and non-null assertions
   - Extract hardcoded values to configuration files

---

## 🧪 Testing Recommendations

1. Add unit tests for all utility functions with edge cases (null inputs, empty arrays)
2. Add integration tests for error paths (network failures, auth state changes)
3. Run E2E tests with throttled network to expose race conditions
4. Perform security audit on sanitization functions with XSS payloads

---

*This report was generated through automated static analysis. Each issue should be manually verified before fixing.*
