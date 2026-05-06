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
- `coinService.ts` — Wallet ledger, coin packs, referrals, payouts (16 ledger entry types)
- `activityService.ts` — Activity logging with rate limiting (25 event types)
- `auditService.ts` — Admin action audit trail (prevents self-targeting on sensitive actions)
- `loyaltyService.ts` — Multi-tier loyalty system (none/bronze/silver/gold/diamond)
- `razorpayService.ts` — Payment integration

React Query hooks in `src/lib/queryClient.ts` cache public profiles (5m), services (2m), and balances (30s).

### Key Firestore Collections

- `users` — Full profiles with role, verification status, coin balance
- `services` — Service listings with moderation status (pending/approved/featured/rejected)
- `bookings` — Booking lifecycle with escrow coins
- `coinLedger` — Coin transaction history
- `auditLogs` — Admin action audit trail (append-only)
- `activityLogs` — User activity events
- `config/platformSettings` — Platform configuration (categories, commission, feature flags)
- `notifications` — Real-time notifications (6 kinds)

### Admin Panel

10 admin pages under `src/pages/admin/`. Key patterns:
- All admin mutations log to `auditLogs` via `captureAuditEvent()`
- Destructive actions require confirmation dialogs
- Service moderation: approve/reject/feature with bulk actions (`AdminServices.tsx`)
- Platform settings including service category management (`AdminSettings.tsx`)
- Wallet admin: payout processing, ledger adjustments (`AdminWallet.tsx`)

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
- Currently covers `loyaltyService.ts` and `src/lib/validation.ts`; expand as needed
- Run single test: `npx vitest run src/services/coinService.test.ts`

**E2E Tests:**
- Tool: Playwright (Chromium only)
- Location: `e2e/` directory
- Timeout: 30 seconds per test
- Test critical user flows (login, booking, payment)
- Use test user seeding: `npm run seed:test-users` (requires Firebase service account key)
- Debug failing tests: `npm run test:e2e:debug` opens Playwright Inspector
- View traces: `npm run test:e2e:trace` records browser actions for replay

## Environment Variables

Required in `.env.local`:
- `VITE_FIREBASE_*` — Firebase project config (apiKey, authDomain, projectId, etc.)
- `VITE_RAZORPAY_KEY_LIVE` — Razorpay payment key
- `VITE_CLOUDINARY_*` — Cloudinary cloud name and upload preset
- Optional: `VITE_FCM_VAPID_KEY`, `VITE_SENTRY_DSN`

## Deployment

Firebase Hosting from `dist/`. Cache strategy: no-cache for HTML/SW/manifest, immutable (1yr) for JS/CSS assets. Firestore rules in `firestore.rules`, indexes in `firestore.indexes.json`.

## Graphify

- Use `graphify-out/graph.json` as the RAG source after a graph build.
- If Graphify is available in the session, rebuild the graph after code or docs changes.
