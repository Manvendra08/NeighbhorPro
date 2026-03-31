# ARCHITECTURE.md - Core Patterns

## Architectural Pattern
**Layered Client-Side-First (CSF)**:
- **Presentation Layer**: Components and Pages using React Router for navigation.
- **State/Logic Layer**: React Context (Auth, UI State) and custom Hooks.
- **Service Layer**: Pure functions in `src/services/` wrapping Firestore/Cloudinary calls.
- **Data Layer**: Cloud Firestore with Security Rules as the primary ACL.

## Identity & Trust System (New Pattern)
- **Public Mirroring Pattern**: 
  - `users/{uid}` (Private Record) - contains phone, balance, FCM, flat number.
  - `publicProfiles/{uid}` (Sanitized Mirror) - contains name, photo, bio, skills.
  - This ensures that a "Browse" or "Search" operation never reads sensitive data, even if client-side filtering fails.

## Real-Time Dynamics
- Uses `onSnapshot` for:
  - **Feed Updates** (Dashboard)
  - **Live Chat** (Messages)
  - **Booking Status Changes** (BookingFlow/Detail)
  - **Wallet Balance** (Wallet/Account)

## Booking Lifecycle
1. `BookingFlow` initiates `holdEscrow`.
2. `pro` updates status (Accept/Start/Complete).
3. `system` or `pro` triggers `releaseEscrow` via `coinService`.
4. Transaction ledger record is written atomically in a `runTransaction`.
