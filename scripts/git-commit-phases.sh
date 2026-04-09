#!/usr/bin/env bash
# ProNeighbour — Phase 3 & 4 Git commit script
# Run from project root: bash scripts/git-commit-phases.sh
set -e

cd "$(dirname "$0")/.."

echo "=== Initialising git if needed ==="
git init 2>/dev/null || true
git remote get-url origin 2>/dev/null || echo "Add remote: git remote add origin <your-repo-url>"

echo ""
echo "=== Epic 6: Payments, NeighbourCoins, UPI ==="
git add \
  src/services/coinService.ts \
  src/pages/Wallet.tsx \
  src/services/razorpayService.ts \
  firestore.rules \
  firestore.indexes.json \
  .env.example
git commit -m "feat(epic6): NC terms panel, referral code generation & claim, tx history empty state, pro cash-out flow

- coinService: getNCTerms(), applyReferralCode(), rewardReferral()
- Wallet: 7 tabs — Overview, Buy, Earn, Refer & Earn, Cash Out, History, NC Terms
- History: proper empty state with CTA
- Referral: share code via WhatsApp/native share, apply friend's code
- NC Terms: expiry, refund policy, earn cap, fee, parity — read from appSettings
- Firestore rules: referrals collection"

echo ""
echo "=== Epic 7: Account, Privacy & Compliance ==="
git add \
  src/contexts/AuthContext.tsx \
  src/pages/MyAccount.tsx \
  src/firebase.ts
git commit -m "feat(epic7): phone OTP, profile completeness meter, privacy controls, logout+delete account

- AuthContext: sendPhoneOTP(), verifyPhoneOTP() via Firebase Phone Auth
- AuthContext: deleteAccount() — soft-delete, DPDP compliant, anonymises profile
- MyAccount: 6-tab layout — Profile, Availability, Privacy, Transactions, Activity, Danger Zone
- Completeness meter: 8 checks, colour-coded progress bar
- Privacy toggles: phone visibility, flat number visibility
- Transaction history wired to coinLedger
- Danger zone: sign out + delete account with password confirmation"

echo ""
echo "=== Epic 8: Support, Tickets & Disputes ==="
git add \
  src/services/supportService.ts \
  src/pages/Support.tsx \
  src/pages/admin/AdminTickets.tsx \
  src/pages/admin/AdminDisputes.tsx \
  src/pages/ProDetail.tsx
git commit -m "feat(epic8): ticketing system, dispute flow, dynamic FAQs, SLA messaging

- supportService: tickets collection, disputes collection, dynamic FAQs, SLA from appSettings
- Support: FAQ with category chips + Firestore data, ticket list+chat, new ticket form with SLA display
- AdminTickets: full chat UI, status transitions (open→in_progress→resolved→closed), audit log
- AdminDisputes: dispute list, detail panel, status workflow, admin notes
- ProDetail: dispute raise modal (only if user has completed booking with pro)
- ProDetail: response time badge (⚡ computed from booking confirm deltas)"

echo ""
echo "=== Epic 9: Notifications, Dark Mode, Polish ==="
git add \
  src/hooks/usePushNotifications.ts \
  src/hooks/useDarkMode.ts \
  src/hooks/useIsMobile.ts \
  src/darkmode.css \
  src/components/layout/TopBar.tsx \
  src/components/layout/Sidebar.tsx \
  src/components/layout/Layout.tsx \
  src/components/PWASplashScreen.tsx \
  public/firebase-messaging-sw.js \
  src/App.tsx \
  src/main.tsx
git commit -m "feat(epic9): FCM push notifications, dark mode toggle, pro response badge, routing polish

- usePushNotifications: FCM token save, foreground + background message handling
- useDarkMode: localStorage + prefers-color-scheme, [data-theme] CSS variables
- darkmode.css: full dark theme for all components with smooth transitions
- TopBar: dark mode toggle, FCM permission prompt, inline in user dropdown
- firebase-messaging-sw.js: background push notifications + notificationclick handler
- Sidebar: Tickets + Disputes admin links, cleaner section labels
- App.tsx: /admin/tickets, /admin/disputes routes added
- PWASplashScreen: standalone-only, mobile-only, session-scoped"

echo ""
echo "=== Cross-cutting: indexes, rules, env ==="
git add \
  firestore.indexes.json \
  firestore.rules \
  .env.example \
  src/responsive.css \
  src/mobile.css \
  src/pwa.css
git commit -m "chore: Firestore indexes for tickets/disputes/referrals/faqs, rules update, env.example

- Added 9 new compound indexes for all Phase 3+4 collections
- Firestore rules: tickets, disputes, faqs, appSettings, referrals, proAvailability
- .env.example: added VITE_FCM_VAPID_KEY and VITE_CLOUDINARY_* keys"

echo ""
echo "=== All commits done. Push to GitHub: ==="
echo "  git push origin main"
echo ""
echo "=== Deploy to Firebase: ==="
echo "  npm run build && firebase deploy --only hosting,firestore:rules,firestore:indexes"
