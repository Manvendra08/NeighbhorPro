# ProNeighbour — End-to-End Test Script
# For: Browser AI Assistant (Claude in Chrome / Operator / similar)
# Format: Sequential test cases with explicit steps, expected results, and reporting instructions
# Base URL: http://localhost:5173 (adjust to deployed URL if testing production)
# Last updated: 2026

---

## INSTRUCTIONS FOR AI ASSISTANT

You are a QA tester for a webapp called **ProNeighbour** — a hyperlocal professional services marketplace for gated communities with a virtual currency system called NeighbourCoins (NC).

**Your job:**
1. Execute each test case below in order
2. For every step: perform the action, observe the result, compare to expected
3. Log PASS / FAIL / BUG / SUGGESTION for each test case
4. At the end produce a structured report with: Bugs Found, UX Issues, Suggestions, Overall Score

**Test accounts to use:**
- Regular user:  email = `testuser@proneighbour.in`   password = `Test@1234`
- Pro user:      email = `testpro@proneighbour.in`    password = `Test@1234`
- Admin user:    email = `admin@proneighbour.in`      password = `Admin@1234`
- New user:      use `newuser_<timestamp>@test.com`   password = `NewUser@1234`

**Before starting:** Open browser console (F12 → Console). Note any errors throughout testing.

---

## MODULE 1 — LANDING PAGE

### TC-001: Landing page loads correctly
1. Navigate to `http://localhost:5173`
2. Verify page title is "ProNeighbour" or similar
3. Verify hero section is visible with headline text
4. Verify countdown timer is counting down (not stuck or showing NaN)
5. Verify "Join Waitlist" button is visible in navbar
6. Verify "Sign In" button is visible in navbar
7. Scroll down — verify all sections load: How It Works, Categories, Features, Testimonials, Early Access, Waitlist
8. Verify all images load (no broken image icons)
9. Verify no console errors

**Expected:** All sections visible, no broken images, countdown ticking, no JS errors
**Report:** PASS/FAIL + list any broken elements

---

### TC-002: Waitlist form validation
1. On landing page, scroll to waitlist section
2. Click "Reserve My Spot →" without entering email
3. Expected: alert or inline error about invalid email
4. Enter invalid email: `notanemail`
5. Click button again
6. Expected: validation error
7. Enter valid email: `waitlisttest@test.com`
8. Click "Reserve My Spot →"
9. Expected: success message appears, form hides, no page reload

**Report:** PASS/FAIL + note if validation is client-side alert (poor UX) vs inline error

---

### TC-003: Landing page navigation
1. Click "How It Works" in navbar
2. Expected: page scrolls smoothly to How It Works section
3. Click "Features" in navbar
4. Expected: scrolls to Features section
5. Click "Sign In" button
6. Expected: navigates to `/login` page
7. Click browser back
8. Navigate to `http://localhost:5173`
9. Click "Join Waitlist →" in sticky nav
10. Expected: scrolls to waitlist section

**Report:** PASS/FAIL

---

## MODULE 2 — AUTHENTICATION

### TC-004: Registration — new user
1. Navigate to `http://localhost:5173/register`
2. Verify registration form loads with fields: Name, Email, Password
3. Submit empty form
4. Expected: validation errors shown
5. Fill in: Name = `Test New User`, Email = `newuser_<timestamp>@test.com`, Password = `NewUser@1234`
6. Click Register / Sign Up
7. Expected: user is created and redirected to `/dashboard`
8. Verify dashboard loads with welcome message showing the user's name
9. Check browser console for errors
10. **Verify:** NC balance shows 100 NC (signup bonus should be auto-credited)

**Report:** PASS/FAIL + note if signup bonus credited correctly

---

### TC-005: Login — valid credentials
1. Navigate to `/login`
2. Enter email: `testuser@proneighbour.in`, password: `Test@1234`
3. Click Sign In
4. Expected: redirects to `/dashboard`
5. Verify user name appears in sidebar/topbar
6. Verify NC balance pill is visible in topbar

**Report:** PASS/FAIL

---

### TC-006: Login — invalid credentials
1. Navigate to `/login`
2. Enter email: `wrong@email.com`, password: `wrongpassword`
3. Click Sign In
4. Expected: error message displayed (not a crash, not a blank screen)
5. Try empty form submission
6. Expected: validation error

**Report:** PASS/FAIL + note quality of error messages

---

### TC-007: Google Sign-In button
1. Navigate to `/login`
2. Verify "Sign in with Google" button is present
3. Click it
4. Expected: Google OAuth popup opens
5. (Do NOT complete — just verify popup opens then close it)
6. Expected: no crash after closing popup

**Report:** PASS/FAIL (note: full Google auth flow requires real Google account)

---

### TC-008: Forgot password flow
1. Navigate to `/login`
2. Click "Forgot password?" link
3. Expected: navigates to `/forgot-password`
4. Enter: `testuser@proneighbour.in`
5. Click submit
6. Expected: success message that reset email was sent
7. Try submitting empty form
8. Expected: validation error

**Report:** PASS/FAIL

---

### TC-009: Protected route — unauthenticated access
1. Log out if logged in (or open incognito)
2. Navigate directly to `http://localhost:5173/dashboard`
3. Expected: redirected to `/login` (NOT shown dashboard)
4. Navigate to `http://localhost:5173/wallet`
5. Expected: redirected to `/login`
6. Navigate to `http://localhost:5173/admin`
7. Expected: redirected to `/login`

**Report:** PASS/FAIL — this is a security test

---

### TC-010: Admin route — non-admin access
1. Log in as regular user (`testuser@proneighbour.in`)
2. Navigate directly to `http://localhost:5173/admin`
3. Expected: redirected away (to dashboard or login), NOT shown admin panel
4. Navigate to `http://localhost:5173/admin/wallet`
5. Expected: same — access denied

**Report:** PASS/FAIL — critical security test

---

## MODULE 3 — DASHBOARD

### TC-011: Dashboard loads and displays correct data
1. Log in as `testuser@proneighbour.in`
2. Verify dashboard loads at `/dashboard`
3. Verify stat cards are visible: Upcoming Bookings, Client Requests, Rating
4. Verify "Browse Professionals" quick action card is clickable
5. Verify "Update Your Profile" quick action card is clickable
6. Verify upcoming bookings section shows correct state (empty state or list)
7. Check for any loading spinners stuck indefinitely

**Report:** PASS/FAIL + note any stuck loaders

---

## MODULE 4 — BROWSE PROFESSIONALS

### TC-012: Browse page loads and filters work
1. Navigate to `/browse`
2. Verify professional cards load (or empty state if no pros exist)
3. Verify search input is present
4. Type "yoga" in search box
5. Expected: results filter in real-time
6. Clear search
7. Click category chip "Tax & CA"
8. Expected: results filter to tax-related pros
9. Click "All" chip
10. Expected: all pros shown again
11. Toggle between Grid and List view buttons
12. Expected: layout changes correctly

**Report:** PASS/FAIL + note if filters are instant or require button click

---

### TC-013: Professional detail page
1. From Browse page, click on any professional card
2. Expected: navigates to `/pro/:id`
3. Verify pro's name, bio, skills, rating are displayed
4. Verify "Book Consultation" or similar CTA button is present
5. Click Back button
6. Expected: returns to browse page

**Report:** PASS/FAIL

---

## MODULE 5 — BOOKING FLOW

### TC-014: Booking flow — free consultation
1. Log in as `testuser@proneighbour.in`
2. Navigate to `/browse`, find a pro with "Free consultation" pricing
3. Click "Book" on that pro
4. **Step 1:** Select a date (tomorrow's date) and a time slot (e.g., 10:00 AM)
5. Add notes: "Test booking — please ignore"
6. Click "Continue"
7. **Step 2:** Verify confirmation screen shows:
   - Professional's name ✓
   - Date ✓
   - Time ✓
   - Payment shows "Free 🎁" ✓
8. Click "Confirm Booking"
9. Expected: Step 3 success screen with confetti/emoji
10. Verify success message mentions "+50 NC for the pro"
11. Click "View Bookings"
12. Expected: booking appears in list with "pending" status

**Report:** PASS/FAIL

---

### TC-015: Booking flow — paid consultation (sufficient balance)
1. Log in as `testuser@proneighbour.in`
2. First verify wallet balance via topbar NC pill — note the amount
3. Find a paid pro (e.g., hourlyRate > 0)
4. Click Book
5. Select date and time, click Continue
6. **Step 2:** Verify:
   - Fee shown in NC (e.g., "🪙 500 NC")
   - "= ₹500 · debited from your wallet" shown
   - Your current balance shown
7. If balance sufficient: click "Pay X NC & Confirm"
8. Expected: success screen with NC deducted amount
9. Verify NC balance in topbar DECREASED by correct amount

**Report:** PASS/FAIL + note if balance updates in real-time

---

### TC-016: Booking flow — insufficient balance
1. Log in as `testuser@proneighbour.in`
2. Find a pro with hourlyRate higher than your NC balance
3. Navigate to their booking page
4. On Step 2, verify:
   - ⚠️ "insufficient" warning shown in red next to balance
   - Red alert box with "Top up wallet →" link
   - Confirm button is DISABLED
5. Click "Top up wallet →" link
6. Expected: navigates to `/wallet`

**Report:** PASS/FAIL

---

### TC-017: Booking validation — missing date/time
1. Navigate to any pro's booking page
2. On Step 1, click "Continue" WITHOUT selecting date or time
3. Expected: error message "Please select a date and time slot"
4. Select date only, click Continue again
5. Expected: same error (time still required)

**Report:** PASS/FAIL

---

## MODULE 6 — WALLET

### TC-018: Wallet page — overview tab
1. Log in and navigate to `/wallet`
2. Verify balance displayed matches NC pill in topbar
3. Verify 3 stat cards: Balance, Equivalent Value, Referral Code
4. Verify referral code format is "PN" + 6 chars
5. Verify "How NeighbourCoins Work" section shows 3 cards
6. Verify "Buy Coins" and "Ways to Earn" buttons work (switch tabs)

**Report:** PASS/FAIL

---

### TC-019: Wallet — buy coins tab
1. Navigate to Wallet → "Buy Coins" tab
2. Verify 5 coin packs are displayed: Trial, Starter, Popular, Pro, Society
3. Verify "Popular" pack has "MOST POPULAR" badge
4. Click each pack — verify selection highlight updates correctly
5. Verify summary box updates when you select different packs
6. Select "Popular" pack (₹500 → 575 NC) — verify summary shows: ₹500, 500 NC base, +75 bonus, 575 total
7. Click "Pay ₹500 via UPI / Card"
8. Expected: Razorpay SDK loads and checkout modal opens
9. (Close the modal without paying)
10. Expected: status shows "Payment cancelled" — no crash

**Report:** PASS/FAIL + note if Razorpay loads correctly (requires VITE_RAZORPAY_KEY_ID to be set)

---

### TC-020: Wallet — earn coins tab
1. Navigate to Wallet → "Earn Coins" tab
2. Verify all earn rules are listed with NC amounts
3. Verify descriptions are shown for each rule
4. Count the items — should be 8 earn rules

**Report:** PASS/FAIL

---

### TC-021: Wallet — transaction history tab
1. Navigate to Wallet → "History" tab
2. If empty: verify empty state with "📋 No transactions yet" message
3. If has entries: verify table shows Date, Description, Type, Amount (+/-), Balance After
4. Verify credit amounts are GREEN, debit amounts are RED
5. Check "earn signup_bonus" entry exists for new accounts

**Report:** PASS/FAIL

---

### TC-022: Wallet — payout tab (Pro user only)
1. Log in as `testpro@proneighbour.in`
2. Navigate to `/wallet`
3. Verify "Cash Out" tab is visible (only for service providers)
4. Click Cash Out tab
5. Verify available balance is shown
6. Try submitting empty form → expected: "Enter a valid amount" error
7. Enter amount below minimum (e.g., 50) → expected: error about minimum 200 NC
8. Enter invalid UPI: "notaupi" → expected: error about valid UPI ID
9. Enter valid amount (200+) and valid UPI: `test@upi`
10. Click "Request Payout"
11. Expected: success message about 48hr processing

**Report:** PASS/FAIL

---

### TC-023: Wallet — payout tab NOT visible for regular users
1. Log in as `testuser@proneighbour.in` (non-pro)
2. Navigate to `/wallet`
3. Verify "Cash Out" tab is NOT visible

**Report:** PASS/FAIL — important UX/access control check

---

## MODULE 7 — MY BOOKINGS

### TC-024: My bookings page
1. Navigate to `/bookings`
2. Verify bookings list loads (or empty state)
3. If bookings exist: verify each shows service name, date, time, status badge
4. Verify status badges are color-coded (pending=yellow, confirmed=green)
5. Check for any infinite loading states

**Report:** PASS/FAIL

---

## MODULE 8 — MESSAGES

### TC-025: Messages page loads
1. Navigate to `/messages`
2. Verify conversations list loads on the left
3. Verify empty state if no conversations
4. If conversations exist: click one, verify chat loads on right
5. Type a message and send it
6. Expected: message appears in chat immediately

**Report:** PASS/FAIL

---

## MODULE 9 — MY ACCOUNT / PROFILE

### TC-026: Account page and profile update
1. Navigate to `/account`
2. Verify profile form loads with current user data
3. Update bio field with: "Test bio update"
4. Click Save
5. Expected: success toast/message
6. Refresh page
7. Expected: bio still shows "Test bio update" (persisted)

**Report:** PASS/FAIL

---

### TC-027: Toggle service provider status
1. Navigate to `/account`
2. Find the "Service Provider" toggle or checkbox
3. Enable it if not already enabled
4. Set hourly rate to: 300
5. Add a skill: "Tax & CA"
6. Save
7. Navigate to `/browse`
8. Expected: your profile appears in browse results
9. Return to `/wallet` — verify "Cash Out" tab now appears

**Report:** PASS/FAIL

---

## MODULE 10 — ADMIN PANEL

### TC-028: Admin dashboard access
1. Log out, log in as `admin@proneighbour.in`
2. Navigate to `/admin`
3. Verify admin dashboard loads with stats
4. Verify sidebar shows admin sections: Users, Societies, Services, Reviews, Broadcast, Support, Wallet Admin, Audit Log, Settings
5. Verify regular user menu items (Browse, Bookings) are also visible

**Report:** PASS/FAIL

---

### TC-029: Admin — User Management
1. Navigate to `/admin/users`
2. Verify users table loads with columns: User, Email, Society, Role, Pro, Rating, Status, Actions
3. Verify stat cards show: Total Users, Active, Disabled, Admins counts
4. Type a name in the search box — verify filtering works
5. Click filter tabs: All, Active, Disabled, Admins, Service Pros
6. Click "Disable" on a non-admin test user
7. Expected: toast success, user status changes to Disabled
8. Click "Enable" to restore
9. Click on a user row to open the detail modal
10. Verify modal shows full profile details
11. Click "Export CSV" — expected: downloads a CSV file

**Report:** PASS/FAIL

---

### TC-030: Admin — Wallet Administration
1. Navigate to `/admin/wallet`
2. Verify page loads without "Missing or insufficient permissions" error
3. **Overview tab:**
   - Verify 4 KPI cards: NC Sold, NC Paid Out, Float, Pending Payouts
   - Verify Economy Health section shows 3 metrics
   - If pending payouts exist: verify orange alert banner is visible
4. **Purchases tab:**
   - Click tab — verify table loads
   - Verify columns: Date, User UID, Pack, Paid(₹), NC Granted, Payment ID, Status
   - Try search by pack name (e.g., "Popular")
   - Click "CSV" export — verify file downloads
5. **Payouts tab:**
   - Verify filter chips: Pending, Processed, Failed, All
   - If pending payouts: verify "✓ Mark Paid" and "✕ Reject" buttons are present
   - Click "Mark Paid" on a pending payout
   - Expected: status changes to "processed", payout removed from pending filter
6. **User Ledger tab:**
   - Search for a user by name
   - Select from dropdown
   - Click "Load Ledger"
   - Expected: transaction table loads for that user
7. **Adjustments tab:**
   - Select "Credit NC" toggle
   - Search and select a user
   - Enter amount: 50
   - Enter reason: "Test credit — QA"
   - Verify confirmation box shows correct summary
   - Click "Credit NC"
   - Expected: success toast
   - Go to User Ledger tab, load same user — verify +50 NC entry exists with type "admin credit"
   - Repeat with "Debit NC": enter 25, reason "Test debit — QA"
   - Expected: success, balance reduced by 25

**Report:** PASS/FAIL per sub-section + note any Firestore permission errors in console

---

### TC-031: Admin — Audit Log
1. Navigate to `/admin/audit`
2. Verify audit log loads
3. Verify recent entries from TC-030 adjustments appear (wallet.admin_credit, wallet.admin_debit)
4. Verify each entry shows: timestamp, action, admin name, details

**Report:** PASS/FAIL

---

### TC-032: Admin — Societies
1. Navigate to `/admin/societies`
2. Click "Add Society" or similar button
3. Fill in society name: "Test Society QA"
4. Save
5. Expected: society appears in list
6. Delete it
7. Expected: removed from list

**Report:** PASS/FAIL

---

## MODULE 11 — NAVIGATION & UX

### TC-033: Sidebar navigation
1. Log in as regular user
2. Click each sidebar item: Dashboard, Browse Pros, My Bookings, Messages, Wallet, My Account, Support
3. Expected: each navigates to correct page without errors
4. Click the collapse toggle on sidebar
5. Expected: sidebar collapses to icon-only mode
6. Verify all icons still work in collapsed mode
7. Expand again

**Report:** PASS/FAIL + note any navigation errors

---

### TC-034: Topbar NC balance pill
1. Log in and note NC balance in topbar pill (format: "🪙 XXX NC")
2. Complete a free booking (TC-014) as a pro user
3. Expected: balance updates in topbar after coin earn event
4. Click the NC pill directly
5. Expected: navigates to `/wallet`

**Report:** PASS/FAIL

---

### TC-035: Mobile responsiveness (resize browser)
1. Open browser DevTools → Toggle device toolbar (Ctrl+Shift+M)
2. Set to iPhone 12 (390×844)
3. Navigate to landing page — verify it's readable, no horizontal overflow
4. Navigate to dashboard — verify sidebar is hidden, bottom nav appears
5. Navigate to wallet — verify all tabs and content are readable
6. Navigate to booking flow — verify steps are usable on mobile
7. Set to iPad (768×1024) — verify layout adapts correctly

**Report:** PASS/FAIL per page + screenshots of major issues

---

### TC-036: Page refresh persistence
1. Log in as `testuser@proneighbour.in`
2. Navigate to `/wallet`
3. Hard refresh (Ctrl+Shift+R)
4. Expected: still on `/wallet`, still logged in, balance correct
5. Navigate to `/browse?search=yoga` (if URL params are supported)
6. Refresh
7. Expected: stays on browse page

**Report:** PASS/FAIL

---

### TC-037: Logout
1. Click user avatar in topbar
2. Click "Sign Out"
3. Expected: redirected to `/login` or `/`
4. Click browser back
5. Expected: NOT able to return to dashboard (redirected to login)

**Report:** PASS/FAIL — security test

---

## MODULE 12 — ERROR HANDLING & EDGE CASES

### TC-038: Direct URL access to non-existent pro
1. Navigate to `http://localhost:5173/pro/nonexistentuid123`
2. Expected: loading spinner that resolves to "not found" state, or graceful redirect
3. NOT expected: blank white screen, JS crash, or infinite spinner

**Report:** PASS/FAIL + describe what actually happens

---

### TC-039: Network error simulation
1. Open DevTools → Network tab → Throttling → set to "Offline"
2. Navigate to `/browse`
3. Expected: error state shown, not infinite spinner
4. Set back to "Online"
5. Refresh — verify page recovers normally

**Report:** PASS/FAIL

---

### TC-040: Booking with past date
1. Navigate to any pro's booking page
2. Try to select yesterday's date in the date picker
3. Expected: past dates are disabled/unselectable (min date = today)

**Report:** PASS/FAIL

---

### TC-041: Console errors audit
1. Open browser console
2. Navigate through: `/`, `/login`, `/dashboard`, `/browse`, `/wallet`, `/bookings`, `/account`, `/admin`, `/admin/wallet`
3. For each page, note any:
   - Red errors (critical)
   - Yellow warnings (non-critical)
   - Failed network requests (404, 403, 500)

**Report:** List all console errors found per page

---

## FINAL REPORTING INSTRUCTIONS

After completing all test cases, generate a structured report in this exact format:

---

# ProNeighbour QA Test Report
**Date:** [today's date]
**Tester:** AI Browser Assistant
**App URL:** [URL tested]
**Browser:** [browser name and version]

## Summary
| Category | Count |
|---|---|
| Total Test Cases | 41 |
| Passed | X |
| Failed | X |
| Bugs Found | X |
| UX Issues | X |
| Suggestions | X |

## Bugs Found (P1 = Critical, P2 = Major, P3 = Minor)
For each bug:
**BUG-001 [P1/P2/P3]: [Short title]**
- TC: TC-XXX
- Steps to reproduce: [brief]
- Expected: [what should happen]
- Actual: [what happened]
- Console error (if any): [paste error]

## UX Issues
For each issue:
**UX-001: [Short title]**
- Location: [page/component]
- Issue: [description]
- Impact: [Low/Medium/High]

## Suggestions for Improvement
For each suggestion:
**SUG-001: [Short title]**
- Location: [page]
- Suggestion: [what to improve and why]

## Security Observations
Note any security concerns found during testing (TC-009, TC-010, TC-037 are security-focused).

## Performance Observations
Note any slow-loading pages, large payloads, or UX-blocking delays.

## Overall Assessment
**Score: X/10**
[2-3 sentence overall assessment of app quality and readiness]

---
END OF TEST SCRIPT
