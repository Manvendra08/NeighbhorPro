---
milestone: v1
created: 2026-04-04T22:45:00+05:30
source: v1-v1-MILESTONE-AUDIT.md
status: planned
phases_created: 5
phases_numbered: 6-10
---

# Gap Closure Plan: ProNeighbor v1.0

## Executive Summary

Generated from milestone audit conducted on 2026-04-04. Five gap-closure phases (6-10) have been created to address:

- **3 unsatisfied requirements** (WLET-04, PERF-01, PERF-02)
- **10 partial requirements** (code exists, verification artifacts missing)
- **7 zero-coverage services** (5 at 0%, 1 critical at 18.52%)
- **4 missing phase verification artifacts** (phases 2-5)

**Total gaps to close:** 8 requirements, 4 phases, 5 service files

---

## Gap Closure Phases

### Phase 6: Wallet Payout Guard & Lifecycle Verification

**Priority:** 🔴 **CRITICAL** — Blocks financial transaction safety

**Closes:**
- ✅ WLET-01: Referral code format enforcement (code exists → needs verification)
- ✅ WLET-02: Payout cancel from wallet UI (code exists → needs verification)
- ✅ WLET-03: Atomic refund + ledger entry (code exists → needs verification)
- ✅ WLET-04: Duplicate payout prevention (UNSATISFIED — needs service-layer guard)

**Gap Root Causes:**
- Phase 3 verification artifact is completely missing
- WLET-04 duplicate prevention is UI-only; `coinService.requestPayout()` lacks pending-check guard

**Proposed Tasks:**
1. **06-01-PLAN.md** — Add service-layer duplicate pending check in `coinService.requestPayout()`
   - Query for existing pending payouts for user before allowing new request
   - Return 409 Conflict error if pending exists
   - Add error handling and telemetry
   
2. **06-02-PLAN.md** — Create Phase 3 verification artifact
   - Write VERIFICATION-REPORT.md for Phase 3
   - UAT all wallet flows: referral format, payout request, cancel, refund, ledger
   - Validate atomicity of cancel + refund + ledger entry

**Coverage Impact:**
- Closes `coinService.ts` critical gap (18.52% → target 80%+)
- Requires tests for: `requestPayout()`, `cancelPayout()`, ledger entry creation

**Dependencies:** None (can execute first)

---

### Phase 7: Messaging & Dashboard Verification

**Priority:** 🟠 **High** — Code implemented, needs verification

**Closes:**
- ✅ MSGS-01: Stable participant identity in conversation list
- ✅ MSGS-02: Consistent counterpart identity in chat header
- ✅ DASH-01: Average rating display with formatting
- ✅ DASH-02: Per-star review distribution details

**Gap Root Cause:**
- Phase 4 verification artifact is completely missing
- Code logic exists in components; no formal UAT or verification document

**Proposed Tasks:**
1. **07-01-PLAN.md** — Create Phase 4 verification artifact (identity fallback)
   - Write VERIFICATION-REPORT.md for Phase 4
   - UAT messaging identity fallback: conversation list labels, chat header identity
   - Validate no generic/unnamed placeholders appear in UI
   
2. **07-02-PLAN.md** — Validate rating display and star-breakdown
   - UAT rating card: average normalization, formatting consistency
   - Test star-breakdown popup: 5★ through 1★ distribution display
   - Verify rating is displayed on first load and after refresh

**Coverage Impact:**
- Currently 0% test coverage for messaging and dashboard components
- Phase 4 verification directly supports components validation

**Dependencies:** None (can execute independently)

---

### Phase 8: Bundle Chunking & Performance Validation

**Priority:** 🟠 **High** — New work required

**Closes:**
- ✅ PERF-01: Bundle warnings reduction via practical chunking strategy
- ✅ PERF-02: Critical route responsiveness validation

**Gap Root Causes:**
- Phase 5 verification artifact is completely missing
- No practical chunk boundary strategy defined in `vite.config.ts`
- No performance measurement baseline or post-chunking validation

**Proposed Tasks:**
1. **08-01-PLAN.md** — Define chunking strategy and apply in vite.config.ts
   - Analyze module dependencies and identify modules >100KB
   - Create vendor chunk, utils chunk, and component chunks
   - Apply chunking strategy in vite.config.ts with rollupOptions
   - Measure bundle size before/after; quantify warning reduction
   - Verify warning count decreases significantly
   
2. **08-02-PLAN.md** — Create Phase 5 verification artifact
   - Write VERIFICATION-REPORT.md for Phase 5
   - Measure critical route FCP, LCP, INP before/after chunking
   - Validate vs baseline: discovery → booking → payment flows
   - Verify build succeeds with no new warnings introduced

**Coverage Impact:**
- No direct service coverage impact
- Improves build output and runtime performance
- Enables PERF-01 and PERF-02 verification

**Dependencies:** Phase 10 should execute first (test coverage prevents noise in perf metrics)

---

### Phase 9: Discovery Filter Fix & Booking Verification

**Priority:** 🟡 **Medium** — Code mostly exists

**Closes:**
- ✅ BKDG-03: Browse Pros with incomplete public profile mirrors (partial → fully satisfied)

**Gap Root Causes:**
- Phase 2 already marked complete in checklist, but verification artifact is missing
- BKDG-03 has known gap: Browse caller doesn't pass server filters to firestoreService
- No formal UAT or verification document

**Proposed Tasks:**
1. **09-01-PLAN.md** — Fix filter passing and create Phase 2 verification artifact
   - Audit BrowsePros.tsx → firestoreService integration
   - Verify Browse caller passes category/distance/availability filters to service
   - Fix if not passed (likely in query builder)
   - Write VERIFICATION-REPORT.md for Phase 2
   - UAT: Browse Pros with various filters, verify mirror-lag fallback activates
   - Verify BKDG-01, BKDG-02, BKDG-03, BKDG-04 all pass (already implemented)

**Coverage Impact:**
- Minimal (booking code already tested in Phase 4)
- Primarily UAT and verification documentation

**Dependencies:** Can execute after Phase 10 (reduces test execution time)

---

### Phase 10: Service Layer Coverage & Integration

**Priority:** 🟡 **Medium–High** — Cross-cutting foundation

**Closes:**
- ✅ Service coverage gaps (firestoreService, coinService critical, others zero)
- ✅ Integration wiring verification across all phases

**Gap Root Causes:**
- 5 service files at 0% coverage: `activityService`, `auditService`, `firestoreService`, `razorpayService`, `supportService`
- `coinService` at 18.52% (critical payout paths undertested)
- No integration tests validating cross-service wiring

**Proposed Tasks:**
1. **10-01-PLAN.md** — Add firestoreService and coinService tests
   - Write unit tests for `firestoreService.ts` list/query helpers with mixed-schema fallbacks
   - Write tests for `coinService.requestPayout()`, `cancelPayout()`, ledger operations
   - Target: firestoreService >60%, coinService >80%
   - Focus on error paths, idempotency, edge cases
   
2. **10-02-PLAN.md** — Add baseline tests for zero-coverage services
   - `auditService.ts`: metadata capture, action gating (target >30%)
   - `supportService.ts`: ticket creation/query (target >30%)
   - `razorpayService.ts`: state transitions, failure handling (target >30%)
   - `activityService.ts`: write/query, event filtering (target >30%)
   
3. **10-03-PLAN.md** — Validate integration wiring
   - Run integration checker: verify discovery → booking → wallet → messaging flows
   - Check all service calls have proper error handling
   - Validate service outputs match page/component expectations

**Coverage Impact:**
- Raises global statements 17.02% → target ~60%+ (not 80%, but significant improvement)
- Enables confident execution of phases 6-9
- Provides regression detection for future changes

**Dependencies:** Should execute early (phases 6-9 depend on solid service layer)

**Execution Note:** Can run tests in parallel; focus on coinService first (critical path)

---

## Priority Execution Order

**Recommended sequence to maximize parallelization:**

1. **Phase 10 (parallel start)** — Service coverage (foundation)
2. **Phase 6 (parallel start)** — Wallet guard (critical, independent)
3. **Phase 8 (after 10)** — Chunking strategy (depends on clean build)
4. **Phase 7** — Messaging/Dashboard verification (independent)
5. **Phase 9 (final)** — Discovery filter + Phase 2 verification (cleanup)

**Estimated Timeline:**
- Phase 10: 3-4 hours (service tests, comprehensive)
- Phase 6: 2-3 hours (guard implementation + verification)
- Phase 8: 2 hours (chunking definition + perf validation)
- Phase 7: 1-2 hours (UAT + verification doc)
- Phase 9: 1 hour (filter fix + verification doc)

**Total: ~10-12 hours of focused work**

---

## Gap Closure Verification

After all gap phases complete, run:

```bash
/gsd-audit-milestone
```

Expected outcomes:
- ✅ 18/18 requirements satisfied (vs 8/18 currently)
- ✅ 5/5 phases with verification artifacts (vs 1/5 currently)
- ✅ All service files >60% coverage (vs 5 at 0%)
- ✅ `coinService` >80% coverage (vs 18.52%)
- ✅ All integration flows wired and tested
- ✅ **Status: ready_for_release** (vs gaps_found)

If all gates pass:

```bash
/gsd-complete-milestone v1
```

This archives v1 and prepares v2 roadmap.

---

## Tracking

- **Created:** 2026-04-04
- **Phases:** 6, 7, 8, 9, 10
- **Directories:** `.planning/phases/{06..10}-*` ✅ created
- **Roadmap:** Updated with all 5 phases ✅
- **Requirements:** Traceability table updated ✅
- **Committed:** Roadmap + Requirements changes ✅

Next: `/gsd-plan-phase 6` to begin planning first gap closure.
