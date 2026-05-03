# Bug Fix TODO - ProNeighbor Round 2

## Phase 1: Critical Fixes
- [ ] Fix `ProAvailabilityEditor.tsx` - timer cleanup + race condition + console.error
- [ ] Fix `ProDetail.tsx` - type assertions + empty catch
- [ ] Fix `Wallet.tsx` - type assertion + timer cleanup 
- [ ] Fix `Profile.tsx` - timer cleanup + empty catch
- [ ] Fix `MyAccount.tsx` - timer cleanup + empty catch

## Phase 2: Type Safety Helpers
- [ ] Add `asString()`, `asNumber()`, `asArray()` helpers to `src/lib/validation.ts`
- [ ] Replace type assertions in key files
- [ ] Add constants for toast durations

## Phase 3: Production Hygiene
- [ ] Replace console statements with `captureError()`
- [ ] Update remaining empty `.catch()` blocks
- [ ] Document hardcoded magic values for future extraction
