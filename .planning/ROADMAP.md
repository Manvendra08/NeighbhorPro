# Roadmap: ProNeighbor v1.0 Trust and Reliability Hardening

**Created:** 2026-04-01
**Milestone:** v1.0
**Requirements mapped:** 18/18

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Admin Governance Hardening | Make high-risk admin actions auditable and safe | ADMN-01, ADMN-02, ADMN-03, ADMN-04 | 4 |
| 2 | Booking and Discovery Reliability | Ensure bookings/pro lists are consistently visible | BKDG-01, BKDG-02, BKDG-03, BKDG-04 | 4 |
| 3 | Wallet and Payout Lifecycle Integrity | Enforce referral format and payout cancel/refund integrity | WLET-01, WLET-02, WLET-03, WLET-04 | 4 |
| 4 | Messaging and Dashboard Trust Signals | Fix participant identity fallback and rating detail UX | MSGS-01, MSGS-02, DASH-01, DASH-02 | 4 |
| 5 | Performance and Release Hardening | Reduce large-chunk risk and preserve runtime responsiveness | PERF-01, PERF-02 | 3 |

## Phase Details

### Phase 1: Admin Governance Hardening
Goal: Enforce explicit safeguards and traceability for high-risk admin workflows.

Success criteria:
- Privilege/role escalation requires explicit confirmation before write.
- Verification actions always persist reviewer metadata and notes.
- Pending verification queue consistently reflects pending-only state.
- Audit logs contain enough structured detail for incident reconstruction.

**Plans:** 2 plans
1. [ ] 01-01-PLAN.md — Harden role escalation confirmation and verification review metadata capture
2. [ ] 01-02-PLAN.md — Ensure verification queue reliability and comprehensive audit logging

**Execute:** `/gsd-execute-phase 01-admin-governance`

### Phase 2: Booking and Discovery Reliability
Goal: Make booking/discovery lists resilient to mixed schema and mirror lag.

Success criteria:
- Client bookings load for both current and legacy client ID fields.
- Pro bookings load for both current and legacy pro ID fields.
- Browse Pros shows providers even if public profile mirror is incomplete.
- Lists are consistently sorted newest-first.

### Phase 3: Wallet and Payout Lifecycle Integrity
Goal: Ensure financial controls are predictable and reversible where valid.

Success criteria:
- Referral code format is enforced as PN + 6 characters.
- Pending payout request can be cancelled from wallet UI.
- Cancellation atomically refunds balance and records ledger transaction.
- Duplicate payout submissions are blocked while one is pending.

### Phase 4: Messaging and Dashboard Trust Signals
Goal: Increase user confidence through clear identity and review signal quality.

Success criteria:
- Messages never degrade to generic unnamed participant labels.
- Chat header and conversation list show stable identity fallbacks.
- Dashboard rating card displays normalized average rating.
- Rating card click reveals 5★ through 1★ breakdown popup.

### Phase 5: Performance and Release Hardening
Goal: Improve production delivery characteristics without behavior regressions.

Success criteria:
- Main bundle warning is reduced through targeted chunking strategy.
- Critical user routes remain performant after chunking changes.
- Build and smoke verification pass before release.

## Coverage Validation

- Total v1 requirements: 18
- Requirements mapped: 18
- Unmapped: 0
- Coverage status: Complete

## Next Command

Run planning for the first phase:
`/gsd-plan-phase 1`
