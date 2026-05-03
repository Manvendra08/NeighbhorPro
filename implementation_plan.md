# Implementation Plan

## Overview
Fix residency proof upload workflow and identify mobile page workflow bugs in ProNeighbor app. The app uses responsive CSS for mobile (no separate mobile pages), so the focus is on fixing upload issues and ensuring proper state refresh after uploads complete.

## Bugs Found

### Critical Bug 1: Missing mirrorPublicProfile call
In `src/services/firestoreService.ts`, the `uploadResidencyProof` function updates the user document but does NOT call `mirrorPublicProfile`. This means the public profile (visible to other users) won't reflect the uploaded residency proof.

### Bug 2: No success feedback in Profile.tsx
After uploading residency proof, the user gets no visual confirmation of success - the UI doesn't update to show "pending" status.

### Bug 3: Validation mismatch (webp)
Profile.tsx allows "image/webp" but cloudinary.ts ALLOWED_TYPES for residencyProof doesn't include webp. This creates confusion - the UI accepts webp but upload may fail.

## Files to Modify
1. `src/services/firestoreService.ts` — Add mirrorPublicProfile call after upload
2. `src/pages/Profile.tsx` — Add success feedback, sync validation types
3. `src/utils/cloudinary.ts` — Add webp to residencyProof allowed types

## Implementation Order
1. [x] Step 1: Investigate codebase and identify bugs (COMPLETED)
2. [ ] Step 2: Add missing mirrorPublicProfile call in uploadResidencyProof
3. [ ] Step 3: Add success feedback in Profile.tsx
4. [ ] Step 4: Fix validation mismatch (add webp to cloudinary.ts)
5. [ ] Step 5: Test the complete workflow
