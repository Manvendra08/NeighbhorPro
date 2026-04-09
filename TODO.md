# ProNeighbor Browse Professionals Fix - Phase 1
Current Working Directory: c:/Users/manvendra.anjan/Downloads/ProNeighbor

## Plan Summary
Fix BrowsePros empty listing by adding server-side `isServiceProvider: true` filter to `listProfessionals()` in firestoreService.ts.
Remove redundant client-side filter in BrowsePros.tsx.

## Steps (Phase 1 Only - Approved)

✅ **Step 1**: Create TODO.md (tracking file) - *COMPLETED*

**Step 2**: Edit `src/services/firestoreService.ts` - *COMPLETED*
- Added `where("isServiceProvider", "==", true)` to primary `publicProfiles` query  
- Fixed fallback `users` query tower filter insertion position
- Firestore will auto-create composite indexes

**Step 3**: Edit `src/pages/BrowsePros.tsx` - *COMPLETED*
- Removed client-side `u.isServiceProvider` filter
- Kept self-exclusion: `data.filter(u => u.uid !== user?.uid)`

**Step 4**: Test - *PARTIAL*
```
✅ npm run dev - Vite running on http://localhost:5173/
⚠️  Firestore index missing → Created firestore.indexes.json
   Deploy: firebase deploy --only firestore:indexes
   Wait 2-5 min for indexes to build (check Firebase Console)
```
```
Navigate to /browse - should now load pros after indexes ready
```

**Step 5**: Complete task with attempt_completion

## Status
✅ Phase 1 code + indexes ✅
🔄 Deploy indexes → Test → Done


