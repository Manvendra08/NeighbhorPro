# Requirements: ProNeighbor

**Defined:** 2026-04-01
**Core Value:** Residents can confidently discover, book, pay, and message trusted local professionals without workflow friction.

## v1 Requirements

### Admin Governance

- [ ] **ADMN-01**: Admin must confirm any role-escalation action before execution.
- [ ] **ADMN-02**: Verification review actions must capture reviewer identity, timestamp, and note context.
- [ ] **ADMN-03**: Verification queue must reliably surface pending records with refresh and filter clarity.
- [ ] **ADMN-04**: High-risk admin actions must remain fully auditable through structured logs.

### Booking and Discovery Reliability

- [x] **BKDG-01**: My Bookings must display client bookings even when legacy ID fields are present.
- [x] **BKDG-02**: My Bookings must display pro-side bookings even when mixed schema fields exist.
- [x] **BKDG-03**: Browse Pros must return visible professionals when public profile mirrors are incomplete.
- [x] **BKDG-04**: Booking/discovery lists must keep deterministic newest-first ordering.

### Wallet and Payout Lifecycle

- [ ] **WLET-01**: Referral code must follow a single enforced format across account creation and updates.
- [ ] **WLET-02**: Pro users must be able to cancel pending payout requests from wallet UI.
- [ ] **WLET-03**: Cancelling a pending payout must atomically refund coins and record a ledger entry.
- [ ] **WLET-04**: Wallet must clearly communicate pending payout state and block duplicate submissions.

### Messaging Identity

- [ ] **MSGS-01**: Conversation list must display stable participant identity labels even without profile hydration.
- [ ] **MSGS-02**: Active chat header must show consistent counterpart identity and avoid generic placeholders.

### Dashboard Trust Signals

- [ ] **DASH-01**: Rating card must display average rating with consistent formatting.
- [ ] **DASH-02**: Clicking rating card must show per-star review distribution details.

### Performance and Delivery

- [ ] **PERF-01**: Bundle warnings must be reduced by introducing practical chunk boundaries for large modules.
- [ ] **PERF-02**: Critical route interactions must remain responsive after chunking changes.

## v2 Requirements

### Platform Expansion

- **PLAT-01**: Add advanced moderation workflows with multi-admin approval chains.
- **PLAT-02**: Introduce richer in-app analytics for pro growth and resident engagement.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native mobile apps | Web reliability milestone takes precedence |
| Full backend migration away from Firebase | High risk and not required for current trust/reliability goals |

## Traceability

| Requirement | Original Phase | Gap Closure Phase | Current Status |
|-------------|---|---|--------|
| ADMN-01 | Phase 1 | — | Pending |
| ADMN-02 | Phase 1 | — | Pending |
| ADMN-03 | Phase 1 | — | Pending |
| ADMN-04 | Phase 1 | — | Pending |
| BKDG-01 | Phase 2 | — | Complete |
| BKDG-02 | Phase 2 | — | Complete |
| BKDG-03 | Phase 2 | Phase 9 | Pending (filter fix + verification) |
| BKDG-04 | Phase 2 | — | Complete |
| WLET-01 | Phase 3 | Phase 6 | Pending (verification artifact) |
| WLET-02 | Phase 3 | Phase 6 | Pending (verification artifact) |
| WLET-03 | Phase 3 | Phase 6 | Pending (verification artifact) |
| WLET-04 | Phase 3 | Phase 6 | Pending (add service guard) |
| MSGS-01 | Phase 4 | Phase 7 | Pending (verification artifact) |
| MSGS-02 | Phase 4 | Phase 7 | Pending (verification artifact) |
| DASH-01 | Phase 4 | Phase 7 | Pending (verification artifact) |
| DASH-02 | Phase 4 | Phase 7 | Pending (verification artifact) |
| PERF-01 | Phase 5 | Phase 8 | Pending (chunking strategy) |
| PERF-02 | Phase 5 | Phase 8 | Pending (route responsiveness) |

**Coverage:**
- v1 requirements: 18 total
- Mapped to original phases: 18
- Gap closure phase assignments: 8 requirements
- Unmapped: 0

**Gap Closure Status:**
- Phase 6 (Wallet): WLET-01, WLET-02, WLET-03, WLET-04
- Phase 7 (Messaging/Dashboard): MSGS-01, MSGS-02, DASH-01, DASH-02
- Phase 8 (Performance): PERF-01, PERF-02
- Phase 9 (Discovery): BKDG-03
- Phase 10 (Service Coverage): Integration support (not direct requirement closure)

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-04 after gap closure phase creation*
