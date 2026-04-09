# ProNeighbour – End-to-End Test Script (UPDATED)
**Version:** 2.0  
**Last Updated:** April 2026  
**Coverage:** 54 Test Cases across 15 Modules  
**Base URL:** http://localhost:5173 (adjust for production)

---

## TEST ACCOUNT CREDENTIALS
```
Regular User:    testuser@proneighbour.in / Test@1234
Pro User:        testpro@proneighbour.in / Test@1234
Admin User:      admin@proneighbour.in / Admin@1234
New User:        newuser_<timestamp>@test.com / NewUser@1234
```

---

## MODULE 1 – LANDING PAGE & WAITLIST

### TC-001: Landing page loads with all sections
1. Navigate to `http://localhost:5173`
2. Verify page title, hero section, countdown timer (no NaN values)
3. Verify navbar: "Join Waitlist", "Sign In" buttons visible
4. Scroll and verify: How It Works, Categories, Features, Testimonials, Early Access, Waitlist sections
5. Verify all images load correctly (no broken icons)
6. Open F12 console → verify no errors
**Expected:** All sections render, no console errors, countdown ticking
**Report:** PASS/FAIL + note broken elements if any

---

### TC-002: Waitlist form validation and submission
1. Scroll to waitlist section
2. Click "Reserve My Spot" without email → expect validation error
3. Enter invalid email: `notanemail` → expect error
4. Enter valid email: `waitlisttest+<timestamp>@test.com`
5. Click submit → expect success message, form clears
6. Verify success toast shows (not page reload)
**Expected:** Client-side validation, success feedback without reload
**Report:** PASS/FAIL + note UX quality (alert vs inline error)

---

### TC-003: Landing page navigation and smooth scrolling
1. Click navbar items: "How It Works", "Features", "Categories" → verify smooth scroll
2. Click "Sign In" → navigate to `/login`
3. Browser back → verify returns to landing page
4. Verify "Join Waitlist" button scrolls to correct section
**Expected:** Smooth navigation, no broken links
**Report:** PASS/FAIL

---

### TC-004: PWA Install Banner (if enabled)
1. Navigate to landing page on desktop
2. Verify "Install App" banner appears (if conditions met)
3. Click install → browser prompt appears
4. Dismiss prompt → banner reappears or closes gracefully
5. Mobile: visit on Android/iOS → verify app install prompt works
**Expected:** Banner displays, installation initiates correctly
**Report:** PASS/FAIL (note: may vary by browser)

---

## MODULE 2 – AUTHENTICATION

### TC-005: User registration with validation
1. Navigate to `/register`
2. Submit empty form → expect validation errors (Name, Email, Password required)
3. Enter: Name = `Test User QA`, Email = `newqa<timestamp>@test.com`, Password = `Test@1234`
4. Click Register → redirect to `/dashboard`
5. Verify welcome message shows user's name
6. Check console for errors
7. **Verify:** NC balance shows 100 (signup bonus credited)
**Expected:** User created, redirected, bonus credited
**Report:** PASS/FAIL + confirm signup bonus awarded

---

### TC-006: Login with valid credentials
1. Navigate to `/login`
2. Enter: `testuser@proneighbour.in` / `Test@1234`
3. Click Sign In → redirect to `/dashboard`
4. Verify username in sidebar/topbar
5. Verify NC balance pill displays
**Expected:** Successful login, user data loaded
**Report:** PASS/FAIL

---

### TC-007: Login error handling
1. Navigate to `/login`
2. Enter: `wrong@email.com` / `wrongpassword`
3. Click Sign In → expect specific error message (not blank screen)
4. Try empty form → expect validation error
5. Try email-only (no password) → expect error
**Expected:** Clear error messages, no crash
**Report:** PASS/FAIL + note error message clarity

---

### TC-008: Google OAuth Sign-In
1. Navigate to `/login`
2. Verify "Sign in with Google" button present
3. Click button → expect Google OAuth popup
4. Close popup without completing auth
5. Verify no crash after closure
**Expected:** Popup opens/closes gracefully
**Report:** PASS/FAIL (full auth requires real Google account)

---

### TC-009: Forgot Password flow
1. Navigate to `/login` → click "Forgot password?"
2. Enter: `testuser@proneighbour.in` → click submit
3. Expect: success message about reset email
4. Try empty form → expect validation error
5. Try non-existent email → verify behavior (send error or generic success)
**Expected:** Form validates, success feedback shown
**Report:** PASS/FAIL

---

### TC-010: Protected routes – unauthenticated access [SECURITY]
1. Incognito/logged-out: navigate to `/dashboard` → expect redirect to `/login`
2. Try `/wallet` → redirect to `/login`
3. Try `/admin` → redirect to `/login`
4. Try `/bookings` → redirect to `/login`
**Expected:** All protected routes redirect to login
**Report:** PASS/FAIL (critical security)

---

### TC-011: Admin route access control [SECURITY]
1. Log in as regular user (`testuser@proneighbour.in`)
2. Try to access `/admin` → expect redirect (not shown admin panel)
3. Try `/admin/wallet`, `/admin/users` → all should redirect
4. Verify no admin UI elements in sidebar
**Expected:** Non-admin users cannot access admin routes
**Report:** PASS/FAIL (critical security)

---

### TC-012: Session persistence on page refresh
1. Log in as `testuser@proneighbour.in`
2. Navigate to `/wallet`
3. Perform hard refresh (Ctrl+Shift+R)
4. Expect: still on `/wallet`, still logged in, balance matches
5. Close and reopen tab → expect session persisted
**Expected:** Auth token/session maintained across refresh
**Report:** PASS/FAIL

---

## MODULE 3 – DASHBOARD

### TC-013: Dashboard layout and stat cards
1. Log in as regular user
2. Verify stat cards visible: Upcoming Bookings, Client Requests, Rating
3. Verify quick action cards: "Browse Professionals", "Update Profile"
4. Click "Browse Professionals" → navigate to `/browse`
5. Browser back to dashboard
6. Verify upcoming bookings section (empty state or list)
7. Check for any stuck loading spinners
**Expected:** All cards load, navigation works, no infinite loaders
**Report:** PASS/FAIL + note any stuck loaders

---

### TC-014: Dashboard pro stats (Pro user view)
1. Log in as `testpro@proneighbour.in`
2. Verify pro-specific stat cards visible (e.g., "Total Earnings", "Completed Services", "Client Rating")
3. Verify "Upcoming Consultations" section with live count
4. Verify "Recent Bookings" list
**Expected:** Pro-specific dashboard shown, stats accurate
**Report:** PASS/FAIL

---

## MODULE 4 – BROWSE & SEARCH

### TC-015: Browse professionals list and filtering
1. Navigate to `/browse`
2. Verify professional cards load (with image, name, rating, price)
3. Verify search input present
4. Type "yoga" in search → results filter in real-time
5. Clear search → all pros shown
6. Click category chip "Tax & CA" → results filtered
7. Click "All" → back to all pros
8. Toggle Grid/List view → layout changes
**Expected:** Search instant, filters work, view toggle works
**Report:** PASS/FAIL

---

### TC-016: Professional detail page
1. From browse, click any professional card
2. Navigate to `/pro/:id`
3. Verify: name, bio, skills, rating, hourly rate, availability
4. Verify "Book Consultation" button present
5. Verify pro's recent reviews shown (if any)
6. Click back → return to browse
**Expected:** Pro detail loads fully, navigation works
**Report:** PASS/FAIL

---

### TC-017: Search with special characters and edge cases
1. Navigate to `/browse`
2. Search for: "@#$%" → expect no crash, empty results or graceful handling
3. Search for empty string → expect all results
4. Search for very long string (100+ chars) → expect graceful handling
5. Try searching by category with multiple filters → expect all to apply
**Expected:** App handles edge cases without crashing
**Report:** PASS/FAIL

---

## MODULE 5 – BOOKING FLOW

### TC-018: Free booking complete flow
1. Log in as `testuser@proneighbour.in`
2. Navigate to `/browse`, select pro with free consultation
3. Click "Book" → **Step 1:** Select date (tomorrow) and time (10:00 AM)
4. Add notes: "Test booking – QA"
5. Click "Continue" → **Step 2:** Verify confirmation shows pro name, date, time, "Free"
6. Click "Confirm Booking" → **Step 3:** Success screen (confetti/emoji)
7. Verify success message mentions "+50 NC for pro"
8. Click "View Bookings" → booking appears with "pending" status
**Expected:** Complete flow works, confirmation accurate, NC credited
**Report:** PASS/FAIL

---

### TC-019: Paid booking with sufficient balance
1. Log in, note NC balance in topbar
2. Select paid pro (hourlyRate > 0)
3. Click Book → Step 1: Select date/time, continue
4. **Step 2:** Verify fee shown in NC, wallet debit amount, current balance
5. If balance sufficient: click "Pay X NC & Confirm"
6. Expect success screen with deducted amount shown
7. Verify topbar NC balance DECREASED by correct amount
8. Navigate to `/wallet` → "History" tab shows debit entry
**Expected:** Payment processed, balance updated, transaction logged
**Report:** PASS/FAIL

---

### TC-020: Booking with insufficient balance
1. Select pro with high rate (> your NC balance)
2. Navigate to booking Step 2
3. Verify: "Insufficient balance" warning shown in red
4. Verify: red alert box with "Top up wallet" link present
5. Verify: Confirm button DISABLED
6. Click "Top up wallet" → navigate to `/wallet`
**Expected:** Insufficient balance prevented, user guided to wallet
**Report:** PASS/FAIL

---

### TC-021: Booking validation – missing date/time
1. Navigate to any pro's booking page
2. Click "Continue" WITHOUT selecting date → expect error: "Please select date and time"
3. Select date only → click Continue → same error
4. Select both → continue succeeds
**Expected:** Client-side validation enforced
**Report:** PASS/FAIL

---

### TC-022: Booking with past date (date picker validation)
1. Navigate to booking page
2. Try to select yesterday's date in date picker
3. Expect: past dates disabled/unselectable (min date = today)
4. Try to manually enter past date in field (if editable) → expect validation error
**Expected:** Past dates prevented
**Report:** PASS/FAIL

---

### TC-023: Pro availability editor and booking slot management
1. Log in as `testpro@proneighbour.in`
2. Navigate to `/account` or pro settings
3. Verify Pro Availability Editor component visible
4. Add available time slot: Tomorrow 9:00 AM – 5:00 PM
5. Save → success message
6. Log out → log in as regular user
7. Book this pro → verify slot appears in date picker
8. Select the slot → confirm booking works
9. Log back as pro → verify booked slot is now unavailable/marked
**Expected:** Availability management works, affects booking availability
**Report:** PASS/FAIL

---

## MODULE 6 – WALLET & PAYMENTS

### TC-024: Wallet overview and balance display
1. Log in and navigate to `/wallet`
2. Verify balance matches topbar NC pill
3. Verify stat cards: Balance, Equivalent Value (₹ conversion), Referral Code
4. Verify referral code format: "PN" + 6 alphanumeric chars
5. Verify 3 sections: How NeighbourCoins Work, Buy Coins, Earn Ways
**Expected:** Wallet loads, balance synced, referral code formatted correctly
**Report:** PASS/FAIL

---

### TC-025: Buy Coins tab and Razorpay integration
1. Navigate to Wallet → "Buy Coins" tab
2. Verify 5 coin packs: Trial, Starter, Popular (badge), Pro, Society
3. "Popular" pack has "MOST POPULAR" badge
4. Click each pack → selection highlight updates
5. Select "Popular" (₹1500 → 575 NC: 500 base + 75 bonus)
6. Verify summary updates correctly
7. Click "Pay ₹1500" → expect Razorpay modal opens
8. **DO NOT pay.** Close modal → expect "Payment cancelled" message, no crash
**Expected:** Razorpay SDK loads, cancellation handled gracefully
**Report:** PASS/FAIL + note if Razorpay modal loads (requires VITE_RAZORPAY_KEY_ID)

---

### TC-026: Earn Coins tab
1. Navigate to Wallet → "Earn Coins" tab
2. Verify all earn rules listed with NC amounts
3. Count rules → expect 8+ different ways to earn
4. Verify descriptions clear (signup bonus, pro earnings, referral, etc.)
**Expected:** All earn methods documented, amounts correct
**Report:** PASS/FAIL

---

### TC-027: Transaction History tab
1. Navigate to Wallet → "History" tab
2. If empty: verify empty state "No transactions yet"
3. If has entries: verify columns: Date, Description, Type, Amount (+/-), Balance After
4. Credit amounts GREEN, debit amounts RED
5. Verify "earn_signup_bonus" entry exists for new accounts (100 NC)
6. Verify recent bookings show correct debit entries
**Expected:** Transaction history logged accurately, formatting correct
**Report:** PASS/FAIL

---

### TC-028: Payout tab (Pro user only)
1. Log in as `testpro@proneighbour.in`
2. Navigate to `/wallet` → verify "Cash Out" tab visible
3. Click "Cash Out" tab
4. Verify available balance shown
5. Try submit empty form → error: "Enter valid amount"
6. Enter amount < 200 (min) → error: "Minimum 200 NC required"
7. Enter invalid UPI: "notaupi" → error: "Invalid UPI format"
8. Enter valid: amount = 500, UPI = `test@upi`
9. Click "Request Payout" → success: "Payout requested, 48hr processing"
10. Verify entry appears in "Pending Payouts" section if visible
**Expected:** Payout form validates correctly, request submitted
**Report:** PASS/FAIL

---

### TC-029: Cash Out tab NOT visible for regular users
1. Log in as `testuser@proneighbour.in` (non-pro)
2. Navigate to `/wallet`
3. Verify "Cash Out" tab is NOT visible
4. Verify only tabs: Overview, Buy Coins, Earn, History
**Expected:** Role-based UI (payout hidden for non-pros)
**Report:** PASS/FAIL

---## MODULE 7 – BOOKINGS & MESSAGING

### TC-030: My Bookings page
1. Log in and navigate to `/bookings`
2. Verify bookings list loads (empty state or list)
3. If bookings exist:
   - Verify each shows: service name, date, time, pro name, status badge
   - Status badges color-coded: pending (yellow), confirmed (green), completed (blue)
4. Click any booking → navigate to `/booking/:id` detail page
5. Verify booking details: pro info, date/time, amount, notes, status
6. Verify CTA buttons contextual (e.g., "Cancel" if pending, "Rate" if completed)
**Expected:** Bookings list accurate, detail view loads, CTAs appropriate
**Report:** PASS/FAIL

---

### TC-031: Cancel booking (before scheduled time)
1. Have an upcoming pending booking
2. On detail page, click "Cancel Booking"
3. Expect confirmation dialog: "Are you sure?"
4. Click confirm → expect success message
5. Verify booking status changes to "Cancelled"
6. Verify NC refunded to wallet (for paid bookings)
7. Navigate to wallet history → verify refund entry
**Expected:** Cancellation works, refund processed, UI updated
**Report:** PASS/FAIL

---

### TC-032: Messages page and chat functionality
1. Log in and navigate to `/messages`
2. Verify conversations list loads on left side
3. If empty: verify empty state message
4. If conversations exist:
   - Click a conversation → chat loads on right
   - Type message: "Test message QA"
   - Click send → message appears in chat immediately
   - Verify message has timestamp and sender indicator
5. Create new conversation or verify chat with another user
**Expected:** Messaging loads, send/receive works, real-time updates
**Report:** PASS/FAIL

---

### TC-033: Message notifications
1. Log in as two users in separate windows (testuser and testpro)
2. From testuser window: send message to testpro
3. In testpro window: verify message appears in real-time
4. Verify notification badge on Messages icon (if messages unread)
5. Click notification badge → navigate to messages
**Expected:** Real-time messaging, notifications work
**Report:** PASS/FAIL

---

## MODULE 8 – USER ACCOUNT & PROFILE

### TC-034: Account page and profile editing
1. Log in and navigate to `/account`
2. Verify profile form loads with user data: Name, Email, Bio, Photo, Society
3. Update bio: "Updated QA Bio"
4. Click Save → expect success toast
5. Hard refresh page → verify bio persisted
6. Verify email is read-only (cannot edit)
**Expected:** Profile updates persisted, email protected
**Report:** PASS/FAIL

---

### TC-035: Photo upload with Cloudinary integration
1. Navigate to `/account`
2. Click profile photo → file upload dialog opens
3. Select valid image (JPG/PNG) < 5MB
4. Verify image previews
5. Click upload → expect image uploaded to Cloudinary
6. Verify new photo displays in profile
7. Refresh page → photo persists
8. Try upload oversized image → expect validation error
**Expected:** Photo upload works, Cloudinary integration valid, validation enforced
**Report:** PASS/FAIL

---

### TC-036: Service provider toggle and pro settings
1. Log in as regular user
2. Navigate to `/account`
3. Find "Become a Service Provider" toggle or checkbox
4. Enable toggle → expand pro settings
5. Set: hourly rate = 300, skills = ["Tax & CA", "Legal Advice"]
6. Add availability (if shown): Monday-Friday 9 AM – 6 PM
7. Click Save → success message
8. Navigate to `/browse` → verify YOUR profile appears in results
9. Log back to `/wallet` → verify "Cash Out" tab now visible
10. Disable provider toggle → revert to regular user
**Expected:** Pro toggle works, pro features activate/deactivate, browse listing updates
**Report:** PASS/FAIL

---

### TC-037: Profile visibility and privacy settings
1. Navigate to `/account` (if privacy section exists)
2. Verify toggles: "Show profile publicly", "Allow messages from non-connections"
3. Toggle "Show profile publicly" OFF
4. Log in as another user → search for this user in `/browse`
5. Verify user does NOT appear in results
6. Toggle ON → appears again
**Expected:** Privacy settings control visibility
**Report:** PASS/FAIL (if feature implemented)

---

## MODULE 9 – DARK MODE

### TC-038: Dark mode toggle and persistence
1. Navigate to any page (logged in or out)
2. Verify dark mode toggle in topbar or settings
3. Click toggle → entire app switches to dark mode
4. Verify all text readable (contrast meets AA standard)
5. Verify background colors, borders, cards all adapt
6. Hard refresh → dark mode persists
7. Toggle back to light mode → persists after refresh
**Expected:** Dark mode toggles, persists, contrast acceptable
**Report:** PASS/FAIL + note any contrast issues

---

### TC-039: Dark mode in all modules
1. Enable dark mode
2. Navigate through: landing page, login, dashboard, browse, wallet, admin
3. Verify each page readable in dark mode
4. Verify no elements hidden (visibility: hidden) or unreadable
5. Check images/logos display correctly
**Expected:** Consistent dark mode across all pages
**Report:** PASS/FAIL + list any broken pages

---

## MODULE 10 – LOYALTY STREAK & GAMIFICATION

### TC-040: Loyalty Streak Widget visibility and tracking
1. Log in as regular user with multiple bookings
2. Navigate to `/dashboard`
3. Verify Loyalty Streak Widget visible (if implemented)
4. Complete a booking → verify streak counter increments
5. Verify streak resets after inactivity period (if defined)
6. Hover/click widget → verify tooltip shows "Consecutive days active" or similar
**Expected:** Streak widget displays, updates on actions
**Report:** PASS/FAIL (if feature implemented)

---

### TC-041: Loyalty bonuses and rewards
1. Maintain active bookings/interactions to build streak
2. Verify NC bonuses awarded for streaks (5-day, 10-day, etc.)
3. Check wallet history → verify bonus entries logged as "loyalty_streak_bonus"
4. Verify bonus amounts increase with longer streaks
**Expected:** Loyalty bonuses calculated and awarded correctly
**Report:** PASS/FAIL

---

## MODULE 11 – ADMIN PANEL (EXPANDED)

### TC-042: Admin Dashboard access and layout
1. Log in as `admin@proneighbour.in`
2. Navigate to `/admin`
3. Verify admin dashboard loads with KPI stats
4. Verify sidebar sections: Users, Societies, Services, Reviews, Bookings, Disputes, Tickets, Broadcast, Support, Wallet, Audit Log, Settings
5. Verify regular user menu items also visible (Browse, Bookings, Wallet)
**Expected:** Full admin panel accessible, all sections visible
**Report:** PASS/FAIL

---

### TC-043: Admin User Management
1. Navigate to `/admin/users`
2. Verify user table loads: Name, Email, Society, Role, Pro Status, Rating, Status, Actions
3. Verify stat cards: Total Users, Active, Disabled, Admins, Pros
4. Search by name → filtering works
5. Click filter tabs: All, Active, Disabled, Admins, Service Pros
6. Click "Disable" on test user → status changes, toast success
7. Click "Enable" → restore
8. Click user row → detail modal/page loads with full profile
9. Click "Export CSV" → CSV file downloads with user data
**Expected:** User management full-featured, filtering works, export valid
**Report:** PASS/FAIL

---

### TC-044: Admin Bookings & Disputes Management
1. Navigate to `/admin/bookings` (if section exists)
2. Verify bookings table loads with: User, Pro, Date, Status, Amount, Actions
3. Filter by status: Pending, Confirmed, Completed, Cancelled
4. Navigate to `/admin/disputes` (if disputes feature exists)
5. Verify disputes list with: User, Pro, Issue, Status, Date
6. Click dispute → detail page shows conversation/resolution info
7. Verify actions: "Resolve", "Reject", "Award NC", etc.
**Expected:** Booking and dispute management accessible
**Report:** PASS/FAIL (if features implemented)

---

### TC-045: Admin Wallet Administration (full)
1. Navigate to `/admin/wallet`
2. **Overview tab:**
   - Verify KPI cards: NC Sold, NC Paid Out, Float, Pending Payouts
   - Verify economy health metrics
   - If pending payouts > 0: verify orange alert banner
3. **Purchases tab:**
   - Verify table: Date, User, Pack, Paid(₹), NC Granted, Payment ID, Status
   - Filter by pack name → works
   - "CSV" export → downloads valid file
4. **Payouts tab:**
   - Filter: Pending, Processed, Failed, All
   - Click "Mark Paid" on pending payout → status → "processed"
   - Click "Reject" → status → "failed", note field appears
5. **User Ledger tab:**
   - Search user by name → select → "Load Ledger"
   - Transaction table loads for that user
   - Verify all transactions shown (credits and debits)
6. **Adjustments tab:**
   - Toggle "Credit NC" or "Debit NC"
   - Search and select user
   - Enter amount and reason
   - Verify confirmation summary correct
   - Click "Credit/Debit NC" → success toast
   - Navigate to User Ledger → verify entry logged (type: "admin_credit" or "admin_debit")
**Expected:** Full wallet admin functionality, all tabs operational
**Report:** PASS/FAIL per sub-section + note Firestore permission errors if any

---

### TC-046: Admin Audit Log and Action Tracking
1. Navigate to `/admin/audit`
2. Verify audit log loads
3. Verify recent admin actions appear: user disable, NC credits, payout approvals
4. Each entry shows: timestamp, action, admin name, user affected, change details
5. Verify log searchable/filterable by action type or user
6. Verify no sensitive data exposed (passwords, etc.)
**Expected:** Audit log complete, traceable, secure
**Report:** PASS/FAIL

---

### TC-047: Admin Societies Management
1. Navigate to `/admin/societies`
2. Verify societies list loads
3. Click "Add Society" → form opens
4. Enter: name = "Test Society QA", location details if required
5. Save → society added to list
6. Edit society → update name → save → verify persistence
7. Delete society → removed from list (with confirmation)
8. Verify users/bookings affected by society changes handled correctly
**Expected:** CRUD operations work, data persisted
**Report:** PASS/FAIL

---

### TC-048: Admin Reviews & Ratings Management
1. Navigate to `/admin/reviews` (if section exists)
2. Verify reviews table loads: User, Pro, Rating, Review Text, Date, Status
3. Filter by rating: 1-star, 2-star, etc.
4. Verify actions: "Approve", "Reject", "Remove" for review moderation
5. Click "Approve" on pending review → appears in pro's profile immediately
6. Click "Reject" → removes from queue
**Expected:** Review moderation works, updates visible to users
**Report:** PASS/FAIL (if feature implemented)

---

### TC-049: Admin Broadcast/Notifications
1. Navigate to `/admin/broadcast` (if exists)
2. Verify form: message text, recipient filter (all users, service pros, specific society)
3. Type test message: "Admin Test Broadcast"
4. Select recipients: "All Users"
5. Click "Send" → success message
6. Log in as regular user → verify notification/message received in `/messages` or notification center
**Expected:** Broadcast sent, users receive notification
**Report:** PASS/FAIL

---

### TC-050: Admin Settings and Configuration
1. Navigate to `/admin/settings` (if section exists)
2. Verify settings sections: Email, Notification, Coin Configuration, Payout Settings
3. Update a setting (e.g., minimum payout amount) → save → verify persistence
4. Reload page → setting still saved
5. Verify no unexpected field changes (immutable fields protected)
**Expected:** Admin settings configurable, persisted
**Report:** PASS/FAIL

---## MODULE 12 – NAVIGATION & UX

### TC-051: Sidebar navigation and responsiveness
1. Log in as regular user
2. Click each sidebar item: Dashboard, Browse, Bookings, Messages, Wallet, Account, Support
3. Each navigates to correct page without errors
4. Click sidebar collapse toggle → sidebar collapses to icon-only
5. Verify all icons still clickable in collapsed mode
6. Verify mobile: bottom nav appears (tab bar) instead of sidebar
7. Expand sidebar → all text visible again
**Expected:** Navigation complete, responsive, no broken links
**Report:** PASS/FAIL + note any navigation issues

---

### TC-052: Mobile responsiveness – key pages
1. Resize browser to iPhone 12 (390x844)
2. Navigate to: landing page, login, dashboard, browse, wallet, booking flow
3. Verify each page readable: no horizontal scroll, text legible, buttons tappable (44px minimum)
4. Test form inputs on mobile: can type, keyboard doesn't hide crucial content
5. Resize to iPad (768x1024) → verify layout adapts correctly
6. Test portrait and landscape orientation
**Expected:** All pages mobile-responsive, no horizontal scroll
**Report:** PASS/FAIL per page + screenshots of major issues

---

### TC-053: Page refresh persistence
1. Log in and navigate to `/wallet`
2. Hard refresh (Ctrl+Shift+R) → expect still on `/wallet`, logged in, balance correct
3. Navigate to `/browse?search=yoga` (if URL params supported)
4. Refresh → expect on browse with yoga search applied
5. Logout, navigate to `/dashboard` → redirect to `/login` (state NOT persisted)
**Expected:** App state persisted across refresh (except logout)
**Report:** PASS/FAIL

---

### TC-054: Error boundary and crash recovery
1. Open console and trigger intentional error (if possible via UI)
2. Verify error boundary catches crash, shows fallback UI
3. Expect "Something went wrong" message + "Reload" or "Go Home" button
4. Click button → app recovers gracefully
5. Navigate to non-existent URL: `/pro/nonexistentuid123` → expect "Not Found" page (not blank)
**Expected:** Errors graceful, user guided to recovery
**Report:** PASS/FAIL

---

## MODULE 13 – PUSH NOTIFICATIONS & PWA

### TC-055: Push notification opt-in and permissions
1. Log in and navigate to `/account` or settings
2. Verify "Enable Notifications" toggle or checkbox
3. Enable → browser asks for notification permission → allow
4. Send test notification (via admin or backend) → expect notification appears
5. Disable toggle → notifications stop being sent
6. Toggle re-enable → permission prompt again (if browser cleared)
**Expected:** Notification opt-in works, browser permission respected
**Report:** PASS/FAIL

---

### TC-056: Notification types and content
1. Complete a booking → expect "Booking Confirmed" notification
2. Receive message from pro → expect "New Message" notification
3. Get NC bonus → expect "NC Earned" notification
4. Verify each notification has: title, message, icon, action URL
5. Click notification → navigate to relevant page (booking, messages, wallet)
**Expected:** Notifications sent for key events, clickable
**Report:** PASS/FAIL

---

### TC-057: PWA installation and offline mode
1. Navigate to landing page (desktop)
2. Look for "Install" banner or use browser menu to install
3. Complete installation → app appears in app drawer/taskbar
4. Open installed app → loads from cache (potentially offline)
5. Online: verify full functionality
6. Go to Network tab → set to "Offline"
7. Try navigating app → expect cached pages load, API calls fail gracefully
8. Go back "Online" → verify sync resumes
**Expected:** PWA installable, offline caching works
**Report:** PASS/FAIL (may vary by browser/platform)

---

## MODULE 14 – SECURITY & VALIDATION

### TC-058: SQL Injection and XSS prevention
1. Try entering SQL payload in search: `' OR 1=1 --` → expect no DB leak
2. Try XSS payload in message: `<script>alert('xss')</script>` → expect script not executed
3. Try HTML injection in bio: `<img src=x onerror="alert('xss')">`  → expect sanitized
4. Verify in page source/console: payloads not executable
**Expected:** All payloads sanitized, no security breach
**Report:** PASS/FAIL

---

### TC-059: CSRF protection (if applicable)
1. Log in and perform state-changing action (e.g., book consultation)
2. Verify request includes CSRF token in header or body
3. Attempt request without token (manual API call) → expect 403/rejected
4. Attempt with invalid token → expect rejected
**Expected:** CSRF tokens validated
**Report:** PASS/FAIL (may require backend inspection)

---

### TC-060: Rate limiting and abuse prevention
1. Attempt rapid requests (e.g., spam booking button clicks)
2. Expect: after N attempts, rate limit error or delay
3. Attempt to brute-force login (10+ wrong attempts)
4. Expect: account locked temporarily or CAPTCHA shown
5. Attempt to spam messages → expect rate limit
**Expected:** Abuse prevented, rate limits enforced
**Report:** PASS/FAIL

---

## MODULE 15 – PERFORMANCE & LOAD

### TC-061: Page load performance
1. Open DevTools → Performance tab
2. Navigate to each key page: landing, dashboard, browse, wallet
3. Measure: First Contentful Paint (FCP), Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS)
4. Expect: FCP < 2s, LCP < 2.5s, CLS < 0.1 (Core Web Vitals targets)
5. Verify JavaScript bundle size reasonable (< 500KB gzipped for main)
**Expected:** Performance acceptable, no major bottlenecks
**Report:** PASS/FAIL + report actual metrics

---

### TC-062: Pagination and infinite scroll (if applicable)
1. Navigate to `/browse` with many professionals (1000+)
2. If paginated: click "Next Page" → results load
3. If infinite scroll: scroll to bottom → more results load
4. Verify no duplicate entries, no missing entries
5. Verify pagination/scroll info (e.g., "Showing 20 of 500")
**Expected:** Pagination/scroll works, results unique
**Report:** PASS/FAIL

---

### TC-063: Large data handling (wallet history, message threads)
1. Log in as user with 100+ transactions
2. Navigate to Wallet → History tab
3. Scroll through all transactions → load time acceptable
4. Filter by type → filters apply without freeze
5. Log in as user with 50+ message conversations
6. Verify conversation list loads without lag
7. Open large conversation (500+ messages) → scroll smooth
**Expected:** Large datasets handled efficiently
**Report:** PASS/FAIL + note any lag

---

## FINAL QA REPORTING TEMPLATE

---

# ProNeighbour QA Test Report
**Date:** [Test Date]  
**Tester:** [Name]  
**App Version:** [Commit Hash / Build ID]  
**Browser:** [Chrome/Safari/Firefox + version]  
**Device:** [Desktop/Mobile + OS]  
**Base URL:** [URL tested]

## Executive Summary
[2-3 sentences on overall app quality and readiness for release]

## Test Execution Summary
| Metric | Count |
|--------|-------|
| Total Test Cases | 63 |
| Passed | X |
| Failed | X |
| Skipped | X (reason) |
| Pass Rate | X% |
| Bugs Found | X |
| UX Issues | X |

## Bugs Found (P1=Critical, P2=Major, P3=Minor)
```
BUG-001 [P1]: Landing page countdown shows NaN
- TC: TC-001
- Steps: Load landing page, observe countdown timer
- Expected: Timer counts down (e.g., "23 days 14:32:08")
- Actual: Shows "NaN days NaN:NaN:NaN"
- Console Error: "Cannot read property 'getTime' of undefined"
- Severity: High (broken hero element on primary landing page)

BUG-002 [P2]: Wallet balance not updating after booking
- TC: TC-019
- Steps: Book paid consultation, observe topbar NC balance
- Expected: Balance decreases by consultation fee immediately
- Actual: Balance updates only after page refresh
- Impact: User uncertainty about payment processing
- Workaround: Refresh page to see updated balance
```

## UX Issues
```
UX-001: Validation errors display as browser alert instead of inline feedback
- Location: Waitlist form, Registration form
- Issue: Uses browser alert() instead of inline error messages
- Impact: Medium – unprofessional, not accessible
- Recommendation: Replace with React toast/error component

UX-002: Mobile keyboard hides form submit button in booking flow
- Location: Booking Step 1, mobile (iPhone 12)
- Issue: When keyboard open, "Continue" button not visible
- Impact: Medium – user cannot see/click submit button
- Recommendation: Adjust layout to keep button visible or use sticky footer button
```

## Security Findings
```
SEC-001 [PASS]: Protected routes properly redirect unauthenticated users to /login
SEC-002 [PASS]: Admin routes deny access to non-admin users
SEC-003 [FAIL]: Sensitive data (user ID) exposed in localStorage unencrypted
  - Recommendation: Encrypt sensitive data or use httpOnly cookies
SEC-004 [PASS]: CSRF token validation on state-changing requests
```

## Performance Observations
```
Landing Page:
  - First Contentful Paint: 1.2s ✓
  - Largest Contentful Paint: 2.1s ✓
  - Cumulative Layout Shift: 0.08 ✓
  - Bundle Size: 245 KB gzipped ✓

Dashboard:
  - Load time: 1.8s ✓
  - No noticeable jank when stat cards update

Wallet (with 200+ transactions):
  - Initial load: 2.3s ✓
  - Scroll performance: smooth ✓
  - Filter response: instant ✓
```

## Suggestions for Future Improvements
```
SUG-001: Add real-time notification badges
  - Location: Sidebar, Messages icon
  - Suggestion: Show unread count badge on Messages icon, update in real-time
  - Reason: Improves discoverability of new messages

SUG-002: Implement booking confirmation email/SMS
  - Location: Booking flow, confirmation step
  - Suggestion: Send email/SMS with booking details, cancellation link
  - Reason: Reduces support requests about booking details

SUG-003: Add undo for pro availability changes
  - Location: Pro availability editor
  - Suggestion: Show "Undo" option for 30 seconds after save
  - Reason: Prevents accidental availability slot deletions

SUG-004: Implement search history / saved filters
  - Location: Browse professionals page
  - Suggestion: Save recent searches, allow saved filters for quick access
  - Reason: Improves UX for returning users
```

## Accessibility Findings (WCAG 2.1 AA Compliance)
```
PASS: 
  - Button contrast ratios meet 4.5:1 on white background
  - Form labels associated with inputs
  - Page structure semantic (headings h1-h3 nested correctly)

FAIL:
  - Dark mode toggle: text-background contrast only 3:1 (needs 4.5:1)
  - Admin table cells: headers not marked with <th> scope attribute
  - Modal dialogs: focus trap not implemented on open

RECOMMENDATIONS:
  - Use Axe or Lighthouse to scan all pages
  - Test with screen readers (NVDA, JAWS)
  - Improve keyboard navigation (tab order)
```

## Blocked/Skipped Tests
```
TC-025 (Razorpay integration): Skipped – Requires VITE_RAZORPAY_KEY_ID environment variable
  - Recommendation: Set env var in test environment, enable full Razorpay testing
  
TC-045 (Full admin wallet admin): Partially skipped – Firestore permissions not fully granted to test admin account
  - Recommendation: Grant test account "editor" role on Firestore for full admin testing
```

## Recommendations for Release
1. **CRITICAL:** Fix countdown timer NaN bug (BUG-001) – impacts trust in landing page
2. **MAJOR:** Implement real-time balance updates (BUG-002) – users need confirmation of payment
3. **MEDIUM:** Replace alert() with inline validation errors (UX-001) – improve UX/accessibility
4. **MEDIUM:** Fix mobile keyboard layout issues (UX-002) – ensure mobile usability
5. **DEFERRED:** Accessibility improvements (WCAG AA compliance) – plan for post-launch
6. **DEFERRED:** Performance optimizations for bundle size – consider lazy-loading admin panel

## Testing Coverage Analysis
**Areas with HIGH Coverage (90%+):**
- Authentication (login, register, password reset)
- Booking flow (free and paid paths)
- Wallet (balance, history, top-up)
- Navigation and routing

**Areas with MEDIUM Coverage (50-89%):**
- Admin panel (all CRUD operations present, edge cases limited)
- Mobile responsiveness (key pages tested, some edge cases untested)
- Messaging and notifications

**Areas with LOW Coverage (<50%):**
- Disputes and conflict resolution
- Loyalty streak gamification (limited test data)
- Integration tests (multiple features interacting)
- Performance under load (stress testing not performed)

## Recommended Future Testing
- **Load Testing:** Simulate 1000+ concurrent users, measure API response times
- **API Testing:** Test backend endpoints directly, edge cases in API responses
- **Cross-Browser:** Test on Safari, Firefox, Edge (currently Chrome-focused)
- **Accessibility:** Full WCAG 2.1 AA audit with screen reader testing
- **Regression:** Automated test suite to prevent future regressions

---

**QA Sign-off:** [Name / Date]  
**Status:** [READY FOR RELEASE / RELEASE BLOCKED / CONDITIONAL RELEASE]

---
