---
phase: 5
requirement: PERF-01
date: 2026-04-05
status: implemented
---

# Performance Bundle Chunking Strategy

## Objective
Reduce large bundle concentration by introducing deterministic manual chunks for vendor, Firebase, service, component, and utility code paths.

## Implemented Strategy
Updated [vite.config.ts](vite.config.ts) with `build.rollupOptions.output.manualChunks`:
- `firebase-vendor`: all Firebase modules
- `vendor`: non-Firebase third-party dependencies
- `services`: modules under `src/services`
- `components`: modules under `src/components`
- `utils`: modules under `src/utils` and `src/lib`

## Why this boundary helps
- Third-party dependencies become cache-stable and isolated from app churn.
- Firebase code splits from generic vendor code to avoid oversized single vendor chunks.
- Service and UI chunks isolate high-change app logic and reduce main entry pressure.

## Validation plan
- Run `npm run build` and compare output chunk distribution.
- Run `npm test` to verify no runtime/test regressions from bundling config changes.
- Follow up with route responsiveness checks for PERF-02 after chunk outputs are captured.

## Next step
Complete PERF-02 validation by measuring route responsiveness before/after chunking on critical flows (browse, booking, wallet, messaging).
