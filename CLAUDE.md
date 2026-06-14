# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ProNeighbor is a verified-neighborhood service marketplace PWA (React + Firebase) where residents discover local professionals, book sessions, and transact using NeighbourCoins. India-focused, with Razorpay payments and society-based trust verification.

## Commands

```bash
npm run dev                # Vite dev server on port 5173
npm run build              # TypeScript check + Vite production build
npm run preview            # Serve production build on port 4173
npm run test               # Vitest with coverage (threads pool)
npm run test:watch         # Vitest in watch mode
npm run test:e2e           # Playwright end-to-end tests (Chromium)
npm run test:e2e:ui        # Playwright interactive UI mode
npm run test:e2e:headed    # Run e2e tests in headed mode (browser visible)
npm run test:e2e:debug     # Debug e2e tests (Playwright Inspector)
npm run test:e2e:report    # View the last test report
npm run test:e2e:trace     # Run e2e tests with trace recording for debugging
npm run test:e2e:install   # Install Playwright browsers
npm run seed:test-users    # Seed test users (requires Firebase service account key)
```

Run a single test file: `npx vitest run src/services/coinService.test.ts`
Run a single e2e test: `npx playwright test e2e/dashboard.spec.ts`

## Tech Stack

- **Frontend:** React 18, React Router 6, TypeScript 5.4 (strict), Vite 6
- **State:** TanStack React Query for server state, React Context for auth
- **Styling:** Modular plain CSS files (`index.css` base, `responsive.css` for tablets, `mobile.css` for phones, `pwa.css` for app shell, `darkmode.css` for theme)
- **Validation:** Zod schemas at boundaries (`src/lib/validation.ts`)
- **Backend:** Firebase (Auth, Firestore, Storage, Hosting, Cloud Functions, Cloud Messaging)
- **Payments:** Razorpay (INR) with coin-based wallet system
- **Media:** Cloudinary for image uploads
- **Monitoring:** Sentry for error tracking
- **Testing:** Vitest + Testing Library + MSW (mocks), Playwright (E2E)

## Architecture

### Routing & Layout

`src/App.tsx` defines all routes. Three route groups:
- **Public:** `/`, `/login`, `/register`, `/terms`, `/privacy`, `/contact`
- **Protected user:** `/dashboard`, `/browse`, `/book/:id`, `/bookings`, `/wallet`, `/messages`, etc.
- **Protected admin:** `/admin/*` (10 sub-pages: users, societies, services, reviews, broadcast, tickets, audit, settings, wallet, bookings)

`ProtectedRoute` component enforces role-based access (`adminOnly`, `userOnly`, `requireVerified` flags). Roles are `"user" | "admin"` stored in Firestore user profile.

### Auth & User State

`src/contexts/AuthContext.tsx` is the single auth provider. It wraps Firebase Auth (`onAuthStateChanged`) and fetches the Firestore user profile via `onSnapshot`. All components access auth via `useAuth()` hook. Supports email/password, Google OAuth, and phone OTP.

### Data Layer

All Firestore operations go through service files in `src/services/`:
- `firestoreService.ts` — CRUD for users, services, bookings, profiles
- `coinService.ts` — Wallet ledger with dual-bucket tracking (cashable NC vs promo NC), coin packs, referrals, payouts (17 ledger types including `subscription_debit`)
- `subscriptionService.ts` — Business listing subscription lifecycle (trial, paid plans, renewal, cancellation) with admin-configurable pricing
- `activityService.ts` — Activity logging with rate limiting (25 event types)
- `auditService.ts` — Admin action audit trail (prevents self-targeting on sensitive actions)
- `loyaltyService.ts` — Multi-tier loyalty system (none/bronze/silver/gold/diamond)
- `razorpayService.ts` — Payment integration (wallet top-up and pro payouts only; subscriptions use NC only)

React Query hooks in `src/lib/queryClient.ts` cache public profiles (5m), services (2m), and balances (30s).

### Key Firestore Collections

- `users` — Full profiles with role, verification status, coin balances (`coinBalance` total, `cashableBalance` real-money sourced, `promoBalance` earned), subscription denorm (`subscription.status`, `subscription.plan`, `subscription.currentPeriodEnd`)
- `services` — Service listings with moderation status (pending/approved/featured/rejected), subscription status (`subStatus: 'paused_subscription' | null`)
- `bookings` — Booking lifecycle with escrow coins
- `coinLedger/{uid}/entries` — Coin transaction history (17 types: topup, booking_*, payout*, earn_*, admin_*, subscription_debit)
- `subscriptions` — Business listing subscription docs (status: trial|active|expired|comped|paused, plan, currentPeriodStart/End, source: trial|coins|comp|admin_grant)
- `subscriptionInvoices` — Paid subscription invoices (idempotent via ledgerEntryId, immutable)
- `auditLogs` — Admin action audit trail (append-only)
- `activityLogs` — User activity events
- `config/platformSettings` — Platform configuration (categories, commission, subscription plans with admin-editable prices `sub3mPriceNC`, `sub6mPriceNC`, `sub12mPriceNC`)
- `notifications` — Real-time notifications (6 kinds)

### Admin Panel

11 admin pages under `src/pages/admin/`. Key patterns:
- All admin mutations log to `auditLogs` via `captureAuditEvent()`
- Destructive actions require confirmation dialogs
- User management: verification, roles, account actions (`AdminUsers.tsx`)
- Service moderation: approve/reject/feature with bulk actions (`AdminServices.tsx`)
- Platform settings including service category management (`AdminSettings.tsx`)
- Subscription pricing: edit 3m/6m/12m plan prices in `AdminSettings.tsx` → `config/platformSettings` (read dynamically by SubscribeSheet)
- Subscription admin: KPI dashboard, grant/revoke/force-cancel actions (`AdminSubscriptions.tsx`)
- Wallet admin: payout processing, ledger adjustments, manual credits/debits (`AdminWallet.tsx`)
- Society management, reviews, broadcast, tickets, audit log, and booking admin pages

### Subscription System (Business Listings)

**Model:** Business-category service listings require an active subscription (3/6/12 month tiers, NC-only payment). First 30 days free for all new pros (trial auto-enrolled on first activation).

**Critical Ledger Pattern:** Subscription payments debit from `cashableBalance` only (via `subscription_debit` ledger type). Earned/promo NC cannot be used for subscriptions. This is enforced in `SubscribeSheet.tsx` validation.

**Plans:** Admin-configurable via `config/platformSettings`:
- `business_3m_v1`: 90 days @ 999 NC (333 NC/mo)
- `business_6m_v1`: 180 days @ 1799 NC (300 NC/mo — best value)
- `business_12m_v1`: 365 days @ 2299 NC (192 NC/mo)

**Lifecycle:** Trial (30d free) → active/renewing → past_due (5d grace) → expired | cancelled | comped | paused (admin).

**Key Pages:**
- `src/pages/SubscriptionManage.tsx` — Pro view: current plan, period end, invoice history, renew/cancel actions
- `src/components/SubscribeSheet.tsx` — Plan picker modal, reads prices from admin config, validations on cashable balance
- `src/components/SubscriptionBanner.tsx` — State-aware status banners (trial → trial_ending → active → renewing → expired, etc.)
- `src/components/ActiveProPill.tsx` — Trust signal on BrowsePros/ProDetail for active pros
- `src/pages/admin/AdminSubscriptions.tsx` — KPI strip (active/trial/expired/comped counts), filterable table, comp/cancel actions

**Ledger Integration:** Subscription payments debit from `cashableBalance` only (real-money sourced NC). Earned NC (`promoBalance`) cannot be used for subscriptions. On successful purchase, `subscription_debit` ledger entry is created, `users.subscription` denorm updated.

**Admin Config:** Edit plan prices, trial days, grace period days in `AdminSettings.tsx` under "Subscription" tab → writes to `config/platformSettings`. Changes reflect live in SubscribeSheet (no cache).

### PWA

Service worker at `public/sw.js` (cache name `proneighbor-v3-*`). Network-first for HTML, cache-first for static assets. Manifest with app shortcuts. `PWAInstallBanner` and `PWASplashScreen` components handle install prompts and standalone launch.

### Build Optimization

`vite.config.ts` splits chunks: `firebase-firestore`, `firebase-auth`, `firebase-messaging`, `react-vendor`, `components`. This keeps the critical path small.

## Coding Conventions

- Prefer immutability — create new objects/arrays, don't mutate (especially React state)
- Keep files small and cohesive — extract responsibilities, avoid god components
- Target 200–400 lines per file; split if exceeding 600 lines
- Handle errors explicitly — no silent catches, user-friendly messages in UI
- Validate at boundaries with Zod schemas, infer types from schemas
- Exported functions/components need explicit types; allow inference for locals
- Avoid `any` — use `unknown` and narrow safely
- Use named `type`/`interface` for React props, not `React.FC`
- No `console.log` in production code

## Common Pitfalls & Anti-Patterns

**Coin Service:**
- ❌ Never call `holdEscrow()` and `createBooking()` together (shared ledger key). Use `createBooking()` alone.
- ❌ Don't mix `cashableBalance` and `promoBalance` in subscription payments. Only cashable NC can be spent on subscriptions.
- ❌ Never forget idempotency keys when crediting coins. Always use unique `refId` to prevent double-spend on network retries.

**Booking Flow:**
- ❌ Don't assume timezone offsets. Use UTC timestamps in Firebase, format in client with user's local timezone.
- ❌ Avoid updating booking state directly. Always go through service layer which logs to audit/activity trails.
- ❌ Don't refund coins and apply referral rewards in separate transactions. Use `runTransaction()` or risk partial failure.

**Admin Operations:**
- ❌ Never skip `captureAuditEvent()` on destructive actions. Audit trail is required for compliance.
- ❌ Don't allow admins to mutate their own account (e.g., delete own user). Check `rule("allowSelfTarget")` in code.
- ❌ Always require confirmation dialogs for bulk operations (service moderation, user deletion, etc.).

**Firebase Rules:**
- ❌ Don't trust client-side validation alone. Firestore rules are the single source of truth.
- ❌ Never allow direct user edits to sensitive fields (`coinBalance`, `subscription.status`). Only service layer updates.
- ❌ Don't use `request.auth.uid` without verifying the field exists. Always check `request.auth != null` first.

## Component & File Organization

**Component structure:** Keep components focused, <400 lines typical, split at ~600 lines.
- **Heavy lifting:** Page components (`src/pages/`) orchestrate data fetching and layout
- **Reusable:** Components in `src/components/` are modular, composable, single-responsibility
- **Custom hooks:** Extract state/logic into `src/hooks/` when used across 2+ components

**File naming:**
- Components: PascalCase (`UserCard.tsx`)
- Hooks: camelCase with `use` prefix (`useUserProfile.ts`)
- Services: camelCase (`firestoreService.ts`)
- Utilities/constants: camelCase or UPPER_SNAKE_CASE

**Props pattern:** Use named `interface ComponentProps`, avoid `React.FC`, let TypeScript infer generic component type.

Example:
```typescript
interface UserCardProps {
  userId: string
  onSelect: (id: string) => void
}

export function UserCard({ userId, onSelect }: UserCardProps) {
  // implementation
}
```

## Error Handling & Monitoring

**Client-side errors:** Use `ErrorBoundary` component to catch React render errors and display fallback UI. Sentry automatically captures unhandled promise rejections and uncaught exceptions.

**Service-layer errors:** Wrap Firebase calls in try-catch. Return typed error objects or throw with clear messages. Example: `throw new Error("Unable to book service: insufficient coins")` (user-facing).

**Server-side errors (Cloud Functions):** Return structured errors with HTTP status codes. Log via `activityService` for audit trails. Avoid leaking sensitive data in error messages.

**Sentry integration:** Configured in `src/main.tsx`. Import `captureError` from `src/lib/sentry` for manual error reporting. Use `operation` context field to tag errors by feature.

## Security & Firestore Rules

**Role-based access:** All user/admin data access is controlled via Firestore rules in `firestore.rules`. Roles (`user` | `admin`) are read from Firestore `users/{uid}.role` field.

**Idempotency keys:** Ledger entries use `refId` (unique keys like `booking_${id}_create_hold_${clientId}`) to ensure duplicate requests (network retries) don't double-charge.

**Amount validation:** All coin operations constrain amounts via Firestore rules (`amount >= 0 AND amount <= 10000`). Input validation happens in service layer with Zod; Firestore rules are the final gate.

**Admin audit trail:** All destructive admin mutations call `captureAuditEvent()` which logs to `auditLogs` collection with user ID, action, target, and timestamp. Prevents accidental self-targeting (e.g., deleting own admin account).

**Subscription ledger integrity:** Subscription payments only debit `cashableBalance` (real-money sourced). Firestore rules enforce: `subscription_debit` entries NEVER touch `promoBalance`. This is also validated client-side in `SubscribeSheet.tsx`.

## State Management Pattern

Use this decision tree:

- **Auth state?** → `useAuth()` from `AuthContext.tsx` (wraps Firebase Auth + Firestore profile)
- **Server data** (users, services, bookings, balances)? → React Query hooks in `src/lib/queryClient.ts` (caching + auto-refetch)
- **UI state** (modal open, filter selection, form input)? → Local `useState`
- **Theme/global UI?** → Create a new Context (currently only auth uses global Context)

React Query caches: profiles (5m), services (2m), balances (30s). Invalidate stale data after mutations via `queryClient.invalidateQueries()` using the same query key.

## Service Layer Pattern

All services in `src/services/` follow this pattern:
1. **Define Zod schema** at the top of the function/file
2. **Parse inputs** — `schema.parse(input)` throws `ZodError` if invalid
3. **Firebase operation** — Firestore read/write or Cloud Function call
4. **Error handling** — Wrap in try-catch, throw user-friendly messages
5. **Return typed results** — Infer types from schema using `z.infer<typeof schema>`

Example: `coinService.ts` validates amounts with Zod, transfers coins via Firestore `increment()`, catches and wraps errors.

**React Query layer:** Wrap services in hooks in `src/lib/queryClient.ts`. Cache profiles (5m), services (2m), balances (30s). Invalidate after mutations: `queryClient.invalidateQueries({ queryKey: ['userBalance', userId] })`.

## Cloud Functions

Backend logic in `functions/`. Deployed via `firebase deploy --only functions`. 
- Use TypeScript with strict mode
- Validate all inputs with Zod
- Return structured errors with HTTP status codes
- Log to Firestore via `activityService` for audit trails

## Service Categories

Service categories are organized into 3 groups in `src/constants/serviceCatalog.ts`:

- **Business:** Tuition & Coaching, Yoga & Fitness, Music & Dance, Language Classes, Nutrition & Diet
- **Services:** Tax & CA, Legal Advisory, Accounting & GST, Investment Planning, Career Coaching, Digital Marketing, Resume & LinkedIn, Homeopathy Doctor, Beauty & Grooming, Professional Services, Design & Branding
- **E-Commerce:** Food & Catering, Apparels & Fashion, Fashion Jewellery, Customized Bags, Home Decor & Crafts, Handmade Gifts, Baking & Desserts

Use `CATEGORY_GROUPS` constant for category dropdowns and filtering. Use `getCategoryGroup(category)` helper to determine which group a category belongs to. Use `SERVICE_CATEGORY_ICONS` for emoji icons in UI.

## Landing Page & Pre-Launch

`src/pages/LandingPage.tsx` + `src/pages/LandingPage.css` is the public landing page (launched May 2026, Park Street Wakad). Update copy/links here before site launch. No dynamic data — static HTML for speed. Service categories section dynamically renders from `CATEGORY_GROUPS` constant.

## Firebase Setup

**Firestore Security Rules:** `firestore.rules` (deployed via CLI)
**Firestore Indexes:** `firestore.indexes.json` (auto-deployed for complex queries)
**Emulator (optional):** Run `firebase emulators:start` for local testing (requires service account key in `functions/`)

## Push Notifications

Browser-based push notifications are enabled for all users (Resident, Pro, Admin) via Firebase Cloud Messaging (FCM).

**Architecture:**
- Unified service worker at `public/sw.js` handles both app-shell caching (network-first for HTML, cache-first for static assets) and FCM background message delivery
- `src/services/notificationService.ts` manages FCM token registration and permission state
- `src/hooks/usePushNotifications.ts` provides permission sync logic (listens to `visibilitychange` and `focus` events to catch permission grants via browser settings)
- `src/components/layout/NotificationCenter.tsx` displays notification UI and handles foreground message callbacks

**Key Implementation Details:**
- Only one service worker can be active per scope (`/`). The unified `sw.js` prevents conflicts between app-shell and FCM handlers.
- FCM token is stored in Firestore `users/{userId}/fcmTokens` collection for server-side message targeting
- Permission state is synced on component mount, visibility change, and focus events
- Auto-prompt on first notification panel open surfaces browser permission dialog proactively
- Foreground messages trigger toast notifications via `NotificationCenter` callback

**Testing:**
- Use `npm run dev` to test locally. FCM requires HTTPS in production but works on `localhost` in dev.
- Test permission grant/deny flows via browser settings (Settings > Notifications > localhost)
- Verify token registration in Firestore `users/{userId}/fcmTokens` after permission grant

## Wallet & Coin System

**NeighbourCoins (NC):** Platform currency — 1 NC = ₹1 INR. Non-expiring (null expiry by default, configurable in `config/appSettings.ncTerms`).

**Dual-Bucket Architecture:** Each user tracks two NC balances:
- **Cashable NC** (`users.cashableBalance`): Real-money sourced (top-ups, booking earnings, refunds). Can be withdrawn via UPI payout. Used for subscription payments.
- **Promo NC / Bonus** (`users.promoBalance`): Platform-earned (signup bonus, profile completion, referrals, reviews, milestones). Cannot be withdrawn. Used only for bookings.
- **Total NC** (`users.coinBalance`): Sum of cashable + promo for display purposes.

**Ledger Types (19):**

Defined in `src/services/coinService.ts` with explicit separation:

- **Cashable sources** (`CASHABLE_LEDGER_TYPES`): `topup`, `booking_escrow_release`, `booking_refund` — real-money sourced NC only
- **Promo sources** (`PROMO_LEDGER_TYPES`): `earn_signup_bonus`, `earn_profile`, `earn_referral`, `earn_review`, `earn_free_consult`, `earn_milestone`, `earn_groupsession`, `earn_ondemand`, `admin_credit` — platform-earned NC only
- **Debits:** `booking_debit` (user spending on bookings), `payout` (UPI withdrawal), `subscription_debit` (subscription renewal), `admin_debit` (admin deduction)
- **Special:** `booking_escrow` (temporary hold during booking), `payout_cancelled` (refund on payout cancellation)

Each ledger entry is immutable and tracked with createdAt timestamp. `cashableBalance` is only affected by cashable types; `promoBalance` only by promo types.

**Wallet Page** (`src/pages/Wallet.tsx`):
- **Overview tab:** NC breakdown (Total/Cashable/Promo), subscription status card, earn rules, referral code
- **Buy tab:** Coin packs (Razorpay top-up), instant credit, bonus preview
- **Earn tab:** Ways to earn with coin values
- **Referral tab:** Shareable code + WhatsApp link, referral reward tracking
- **Cash Out tab** (Pros only): Withdraw from `cashableBalance` only, UPI redemption, min 200 NC
- **Subscription tab:** Current plan, pricing table, manage link
- **History tab:** Full ledger with 50-entry pagination, colors per ledger type
- **NC Terms tab:** Expiry policy, refund policy, earn cap, min payout

**Payout Flow:**
1. Pro enters amount + UPI ID in Cash Out tab
2. Validation: amount ≥ 200 NC, `cashableBalance` ≥ amount
3. On confirm: `requestPayout()` creates `coinPayouts` doc (status: pending), debit `cashableBalance`, log `payout` ledger entry
4. Admin processes payout via `AdminWallet.tsx` → Razorpay/bank transfer → mark processed
5. On cancel: `cashableBalance` refunded atomically

## Debugging & Monitoring

- **Sentry:** Error tracking via `VITE_SENTRY_DSN`. Configure in `src/main.tsx`
- **Activity Logs:** User actions logged via `activityService.ts` (25 event types, rate-limited)
- **Audit Logs:** Admin mutations logged via `auditService.ts` (append-only, prevents self-targeting)

## Testing

**Unit/Integration Tests:**
- Tool: Vitest with Testing Library
- Setup: `src/test/setup.ts` configures jsdom, Testing Library, and error handlers
- Mocking: MSW handlers in `src/test/msw.ts` intercept Firestore/API calls
- Coverage thresholds: 80% statements/lines/functions, 60% branches
- Currently covers: `loyaltyService.ts`, `coinService.ts` (partial), `src/lib/validation.ts`
- Run single test: `npx vitest run src/services/coinService.test.ts`
- Run with coverage: `npm run test:coverage`

**E2E Tests:**
- Tool: Playwright (Chromium only)
- Location: `e2e/` directory
- Timeout: 30 seconds per test
- Test critical user flows: login, booking lifecycle, payment/payout, subscription
- Use test user seeding: `npm run seed:test-users` (requires Firebase service account key)
- Debug failing tests: `npm run test:e2e:debug` opens Playwright Inspector
- View traces: `npm run test:e2e:trace` records browser actions for replay
- Runs dotenv from `functions/` to access Firebase service account

**Coverage Gaps:** AdminPanel pages, message service, notification service, and some payment flows are not yet covered by automated tests.

## Environment Variables

Required in `.env.local`:
- `VITE_FIREBASE_*` — Firebase project config (apiKey, authDomain, projectId, etc.)
- `VITE_RAZORPAY_KEY_LIVE` — Razorpay payment key
- `VITE_CLOUDINARY_*` — Cloudinary cloud name and upload preset
- Optional: `VITE_FCM_VAPID_KEY`, `VITE_SENTRY_DSN`

## Deployment

Firebase Hosting from `dist/`. Cache strategy: no-cache for HTML/SW/manifest, immutable (1yr) for JS/CSS assets. Firestore rules in `firestore.rules`, indexes in `firestore.indexes.json`.

## Coin Service Transactional Patterns

Critical patterns in `src/services/coinService.ts` (recently hardened for production):

**Race Condition Prevention:**
- `requestPayout()` and `topUpCoins()` use `runTransaction()` with internal lock checks — pending-payout existence check happens inside the transaction (not before) to prevent TOCTOU (time-of-check-time-of-use) race
- Pattern: Use `tx.get()` for reads inside transaction, never `getDocs()` outside + transaction write

**Referral Reward Split Flow:**
- `applyReferralCodeAtSignup()` credits referrer (200 NC) at signup, sets `referralStatus: "rewarded_signup"`
- `rewardReferral()` credits new user (200 NC) on first booking, transitions to `"rewarded_booking"`
- Both have idempotency guards: ledger entry existence check before crediting
- Pattern: Use `refId` (e.g., `referral_${referrerId}_signup`) to deduplicate ledger entries

**Zero-Amount Guards:**
- `releaseEscrow()` guards against zero-escrow early return and checks that `escrowStatus` is not already `"refunded"` or `"released"` (prevents re-completing cancelled bookings)
- Pattern: Document state transitions explicitly to prevent double-spending

**Recent Fixes:**
- Removed `payForBooking` alias (was a type-unsafe cast of `holdEscrow`)
- Fixed UPI masking to handle short handles correctly
- Added explicit `CASHABLE_LEDGER_TYPES` and `PROMO_LEDGER_TYPES` exports for clarity

## Known Issues

See `BUGS.md` for active issue tracking. Key recent fixes (as of 2026-05-21):

- ✅ Duplicate `cancelBookingAndRefund` removed from `bookingService.ts`
- ✅ Shared ledger key race between `createBooking` + `holdEscrow` documented (use distinct keys)
- ✅ Referral reward split restored (signup vs booking phases)
- ✅ Payout request race condition fixed (lock inside transaction)
- ⚠️ Timezone bug in rebook date picker (IST off-by-1) — still open
- ⚠️ Platform fee default mismatch (10% vs 15%) — still open

Future developers: Check `BUGS.md` before implementing booking or coin service changes.

## Graphify

- Use `graphify-out/graph.json` as the RAG source after a graph build.
- If Graphify is available in the session, rebuild the graph after code or docs changes.
