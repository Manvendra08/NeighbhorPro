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
| 6 | Wallet Payout Guard & Lifecycle Verification | Close WLET-04 gaps and verify all wallet requirements | WLET-01, WLET-02, WLET-03, WLET-04 | 4 |
| 7 | Messaging & Dashboard Verification | Verify messaging and dashboard trust signals | MSGS-01, MSGS-02, DASH-01, DASH-02 | 4 |
| 8 | Bundle Chunking & Performance Validation | Define chunking strategy and validate performance | PERF-01, PERF-02 | 2 |
| 9 | Discovery Filter Fix & Booking Verification | Fix BKDG-03 filter gap and create Phase 2 verification | BKDG-03 | 1 |
| 10 | Service Layer Coverage & Integration | Add tests for zero-coverage services and expand coinService | Integration Support | - |

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

Status: Complete (implemented and build-verified on 2026-04-04).

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
- Gap closure phases added: 5 (phases 6-10)

## Gap Closure Phases

### Phase 6: Wallet Payout Guard & Lifecycle Verification
Goal: Implement service-layer duplicate payout guard and verify all wallet requirements end-to-end.

Success criteria:
- Service-layer pending payout check prevents duplicate submissions.
- Referral format enforcement is validated across all paths.
- Payout cancellation atomically refunds and logs ledger entry.
- Phase 3 verification artifact documents all wallet flows.

**Priority:** 🔴 CRITICAL (unblocks financial transaction safety)

**Plans:**
1. [ ] 06-01-PLAN.md — Add pending-check guard and duplicate prevention in coinService.requestPayout()
2. [ ] 06-02-PLAN.md — Create Phase 3 verification artifact with full wallet lifecycle UAT

### Phase 7: Messaging & Dashboard Verification
Goal: Create phase 4 verification artifact and validate identity fallback + rating signals.

Success criteria:
- Messaging conversation list and chat header show no generic labels.
- Identity fallback consistency is validated end-to-end.
- Rating card displays normalized average with correct formatting.
- Star-breakdown interaction is verified per requirement.

**Priority:** 🟠 High (code exists, needs UAT)

**Plans:**
1. [ ] 07-01-PLAN.md — Create Phase 4 verification artifact with identity fallback UAT
2. [ ] 07-02-PLAN.md — Validate rating display and star-breakdown interaction

### Phase 8: Bundle Chunking & Performance Validation
Goal: Define practical chunk boundaries and validate that critical routes remain responsive.

Success criteria:
- Vite chunking strategy is defined for modules >100KB.
- Bundle warning is reduced after chunking applied.
- Critical route responsiveness is measured and validated.
- Phase 5 verification artifact documents all performance improvements.

**Priority:** 🟠 High (new work required)

**Plans:**
1. [ ] 08-01-PLAN.md — Define chunking strategy in vite.config.ts and measure bundle impact
2. [ ] 08-02-PLAN.md — Create Phase 5 verification artifact with route responsiveness validation

### Phase 9: Discovery Filter Fix & Booking Verification
Goal: Fix BKDG-03 filter gap and create Phase 2 verification artifact.

Success criteria:
- Browse Pros caller passes server filters correctly to firestoreService.
- Phase 2 verification artifact captures all booking/discovery UAT.
- BKDG-03 partial requirement is fully satisfied.

**Priority:** 🟡 Medium (code mostly exists)

**Plans:**
1. [ ] 09-01-PLAN.md — Fix filter passing in Browse Pros and create Phase 2 verification artifact

### Phase 10: Service Layer Coverage & Integration
Goal: Add tests for zero-coverage services and expand critical wallet service coverage.

Success criteria:
- firestoreService.ts coverage >60% (query/list helpers and fallbacks).
- coinService.ts coverage >80% (payout lifecycle, error paths, idempotency).
- auditService.ts, supportService.ts, razorpayService.ts, activityService.ts have baseline tests (>30% coverage each).
- All service → page integration wiring is verified.

**Priority:** 🟡 Medium–High (cross-cutting foundation)

**Plans:**
1. [ ] 10-01-PLAN.md — Add firestoreService and coinService tests
2. [ ] 10-02-PLAN.md — Add auditService, supportService, razorpayService, activityService baseline tests
3. [ ] 10-03-PLAN.md — Validate all service integration wiring with integration checker

## Next Command

Run planning for the first gap closure phase:
`/gsd-plan-phase 6`
