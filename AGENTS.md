# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

ProNeighbor is a verified-neighborhood service marketplace PWA (React + Firebase) where residents discover local professionals, book sessions, and transact using NeighbourCoins. India-focused, with Razorpay payments and society-based trust verification.

## Commands

```bash
npm run dev          # Vite dev server on port 5173
npm run build        # TypeScript check + Vite production build
npm run preview      # Serve production build on port 4173
npm run test         # Vitest with coverage (threads pool)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright end-to-end tests (Chromium)
npm run test:e2e:ui  # Playwright interactive UI mode
```

Run a single test file: `npx vitest run src/services/coinService.test.ts`

## Tech Stack

- **Frontend:** React 18, React Router 6, TypeScript 5.4 (strict), Vite 6
- **State:** TanStack React Query for server state, React Context for auth
- **Styling:** Plain CSS files (index.css, responsive.css, mobile.css, darkmode.css)
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
- Handle errors explicitly — no silent catches, user-friendly messages in UI
- Validate at boundaries with Zod schemas, infer types from schemas
- Exported functions/components need explicit types; allow inference for locals
- Avoid `any` — use `unknown` and narrow safely
- Use named `type`/`interface` for React props, not `React.FC`
- No `console.log` in production code

## Service Layer Pattern

All services in `src/services/` follow this pattern:
1. **Input validation** with Zod (at function entry)
2. **Firebase operation** (Firestore read/write via SDK or Cloud Functions)
3. **Output transformation** if needed
4. **Error handling** with user-friendly messages

Example: `coinService.ts` validates coin amounts, calls Firestore ledger operations, returns typed results.

React Query hooks cache responses by key (profiles 5m, services 2m, balances 30s). Invalidate on mutations via `queryClient.invalidateQueries()`.

## Cloud Functions

Backend logic in `functions/`. Deployed via `firebase deploy --only functions`. 
- Use TypeScript with strict mode
- Validate all inputs with Zod
- Return structured errors with HTTP status codes
- Log to Firestore via `activityService` for audit trails

## Landing Page & Pre-Launch

`src/pages/LandingPage.tsx` + `src/pages/LandingPage.css` is the public landing page (launched May 2026, Park Street Wakad). Update copy/links here before site launch. No dynamic data — static HTML for speed.

## Firebase Setup

**Firestore Security Rules:** `firestore.rules` (deployed via CLI)
**Firestore Indexes:** `firestore.indexes.json` (auto-deployed for complex queries)
**Emulator (optional):** Run `firebase emulators:start` for local testing (requires service account key in `functions/`)

## Debugging & Monitoring

- **Sentry:** Error tracking via `VITE_SENTRY_DSN`. Configure in `src/main.tsx`
- **Activity Logs:** User actions logged via `activityService.ts` (25 event types, rate-limited)
- **Audit Logs:** Admin mutations logged via `auditService.ts` (append-only, prevents self-targeting)

## Testing

- Coverage thresholds: 80% statements/lines/functions, 60% branches
- Test setup: `src/test/setup.ts` with MSW handlers in `src/test/msw.ts`
- E2E tests in `e2e/` directory (Playwright, Chromium only, 30s timeout)
- Test user seeding: `npm run seed:test-users` (requires Firebase service account key)

## Environment Variables

Required in `.env.local`:
- `VITE_FIREBASE_*` — Firebase project config (apiKey, authDomain, projectId, etc.)
- `VITE_RAZORPAY_KEY_LIVE` — Razorpay payment key
- `VITE_CLOUDINARY_*` — Cloudinary cloud name and upload preset
- Optional: `VITE_FCM_VAPID_KEY`, `VITE_SENTRY_DSN`

## Deployment

Firebase Hosting from `dist/`. Cache strategy: no-cache for HTML/SW/manifest, immutable (1yr) for JS/CSS assets. Firestore rules in `firestore.rules`, indexes in `firestore.indexes.json`.
