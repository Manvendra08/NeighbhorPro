# ProNeighbor

## What This Is

ProNeighbor is a verified-neighborhood service marketplace where residents discover local professionals, book sessions, and transact using NeighbourCoins. It is designed for trust-first community interactions with strong admin controls for moderation, verification, and safety. The product focuses on reliable day-to-day workflows for residents, pros, and admins.

## Core Value

Residents can confidently discover, book, pay, and message trusted local professionals without workflow friction.

## Requirements

### Validated

- ✓ Admin confirmation gates for destructive actions were implemented and deployed.
- ✓ Broadcast send flow now requires preview confirmation.
- ✓ Verification queue and reviewer audit metadata are active in admin workflows.
- ✓ Ticket assignment and audit-date filtering shipped for admin operations.

### Active

- [ ] Improve trust and reliability in admin privilege and verification operations.
- [ ] Stabilize bookings/pro discovery data loading and consistency across user states.
- [ ] Strengthen wallet payout lifecycle transparency and user controls.
- [ ] Improve messaging participant identity consistency.
- [ ] Reduce frontend performance and bundle-size regressions for production UX.

### Out of Scope

- Native mobile app clients — current milestone remains web-first.
- Full marketplace re-architecture — optimize and harden existing architecture first.

## Context

- Stack: React + TypeScript + Vite + Firebase (Auth, Firestore, Hosting, Functions).
- The project already contains admin tooling, wallet ledger/payout logic, booking lifecycle, and chat.
- Recent QA-driven work addressed critical admin confirmation gaps and verification process integrity.
- Remaining risk concentration is in edge-case reliability, trust UX, and performance scaling.

## Constraints

- **Tech stack**: Continue on Firebase + Vite architecture — avoid disruptive platform migrations mid-cycle.
- **Compatibility**: Preserve existing user/admin flows and route contracts.
- **Security**: Protect admin and financial actions with explicit confirmations and traceability.
- **Performance**: Keep UX responsive while reducing large-bundle impact in production.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Prioritize trust/reliability before major feature expansion | Current production risk is from workflow edge cases, not missing feature breadth | — Pending |
| Keep iterative hardening within existing architecture | Fastest path to safer releases without migration risk | — Pending |

## Current Milestone: v1.0 Trust and Reliability Hardening

**Goal:** Improve production trust and reliability across admin governance, booking discovery, wallet payout lifecycle, messaging identity, and frontend performance.

**Target features:**
- Admin workflow hardening for verification/privilege and auditability
- Booking and Browse Pros data reliability improvements
- Wallet payout lifecycle controls including cancellation transparency
- Messaging participant identity consistency
- Performance and bundle optimization for better load behavior

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-01 after starting milestone v1.0*
