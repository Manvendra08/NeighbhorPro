# Phase 02: Booking and Discovery Reliability - Context & Requirements

**Phase:** 02-booking-discovery  
**Milestone:** v1.0 Trust and Reliability Hardening  
**Requirements:** BKDG-01, BKDG-02, BKDG-03, BKDG-04 (4/18)

---

## Business Context

ProNeighbor matches residents (clients) with service professionals (pros). Two critical user flows depend on data consistency:

1. **Client Bookings** - User sees past bookings (booked professionals)
2. **Pro Bookings** - Professional sees bookings from clients
3. **Browse Pros** - Users search for available service professionals
4. **Discovery Lists** - Pros, referrals, services organized by recency

### Current State: Mixed Schema & Mirror Lag

The system has evolved through schema changes:
- **clientUid** field → newer clients use this
- **clientId** field → legacy clients still use this
- **proUid** field → newer pros use this
- **proId** field → legacy pros still use this

Additionally, there's a public profile mirroring system that lags:
- User updates profile → main user document updated first
- Public profile mirror updated asynchronously → may be incomplete briefly
- Browse Pros queries mirror → might not find pro if mirror lag

**Problem:** Lists fail to load bookings for mixed schema, or fail to show pros during mirror lag window.

---

## Requirements Breakdown

### BKDG-01: Client Bookings Load with Schema Fallback
**Goal:** User can see all their past bookings regardless of whether client data uses old/new schema

**Success Criteria:**
- Bookings query searches `clientUid` (new field)
- If no results AND legacy fallback enabled, also search `clientId` (old field)
- Results merged to show complete booking history
- No duplicate bookings if both fields present

**Affected Queries:**
- `/src/services/firestoreService.ts` - `getClientBookings()` or similar

---

### BKDG-02: Pro Bookings Load with Schema Fallback
**Goal:** Professionals can see all their bookings regardless of old/new schema

**Success Criteria:**
- Bookings query searches `proUid` (new field)
- If no results, also search `proId` (old field)
- Results merged to show complete list
- No duplicates

**Affected Queries:**
- `/src/services/firestoreService.ts` - `getProBookings()` or similar

---

### BKDG-03: Browse Pros Resilient to Mirror Lag
**Goal:** Users always see available pros even if public profile mirror is temporarily behind

**Success Criteria:**
- Browse Pros queries either:
  - Public profile collection (mirrored, for performance)
  - Fallback to main user collection if mirror missing
- OR: Query main users collection directly for source-of-truth
- Results show pro with name/photo/rating even if mirror incomplete

**Affected Queries:**
- `/src/services/firestoreService.ts` - `getBrowsePros()` or similar
- `/src/pages/BrowsePros.tsx` - UI rendering

---

### BKDG-04: Lists Consistently Sorted Newest-First
**Goal:** All discovery lists (bookings, browse, referrals) sort by date consistently

**Success Criteria:**
- Bookings sorted by `createdAt` DESC (newest first)
- Browse Pros sorted by signup/profile creation DESC (newest pros first)
- Referral lists sorted by date DESC
- Sorting applied at query time (not post-fetch)
- Sort order documented and tested

---

## Discovery Questions

### Schema Migration Strategy
1. How many users still have legacy `clientId`/`proId` fields?
2. Is there a migration deadline for legacy → new fields?
3. Should queries use `||` fallback or parallel queries?

### Mirror Lag Window
1. What's the typical mirror lag time? (ms, seconds, minutes?)
2. Is there a way to force mirror update on publish?
3. Should Browse Pros show "unmirrored" data with degraded UI?

### Query Performance
1. Are queries indexed on `clientUid`, `proUid`, `createdAt`?
2. Will dual-field queries impact performance?
3. Should fallback query only trigger if main query returns 0 results?

### Sorting Behavior
1. What's the current sort order?
2. Do all views need newest-first, or some specific to oldest-first?
3. Should secondary sort be by rating, name, or something else?

---

## Technical Assumptions

1. **Firestore Structure:**
   - `bookings/{bookingId}` - clientUid, proUid, createdAt
   - `users/{uid}` - displayName, rating, proStatus
   - `publicProfiles/{uid}` - mirror of user public fields
   - `referrals/{referralId}` - created from completed bookings

2. **Query Pattern:**
   - Main queries use `where()` and `orderBy()`
   - Fallback queries OR'd at application level (not Firestore union)
   - Results deduplicated client-side if needed

3. **UI Rendering:**
   - Fallback data shown with same formatting as primary data
   - Placeholder used if photos missing (mirror lag)
   - Loading state handles async mirror updates

---

## Phase Goals

✅ Make booking/discovery lists resilient to schema evolution  
✅ Ensure pro visibility during mirror lag  
✅ Standardize sort order across all lists  
✅ Maintain query performance

---

## Dependencies

- Phase 01: Admin Governance ✅ (completed, no blocking)
- External: Firestore indexes for dual queries
- External: Public profile mirroring infrastructure (exists, may need tuning)

---

## Next Steps

1. **Discovery:** Confirm schema migration timeline and mirror lag metrics
2. **Planning:** Create 02-01 and 02-02 plans with specific query changes
3. **Execution:** Implement fallback queries, sort ordering, UI resilience
4. **Verification:** Test with mixed schema data, simulate mirror lag
