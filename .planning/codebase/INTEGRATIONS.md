# INTEGRATIONS.md - System Connectors

## Internal Subsystems
1. **Coin Economy (`coinService.ts`)**:
   - Manages NC (NeighbourCoin) balance, escrow, and earnings.
   - Integrates with Firestore for ledger transactions.
2. **Identity (`authService`, `AuthContext`)**:
   - High-level wrappers for Firebase Auth.
   - **Key Feature**: Automatic profile creation and public profile mirroring.
3. **Property Verification (`Support.tsx`, `AdminUsers`)**:
   - Handles society/locality linkage and resident proof uploading (via Cloudinary).
4. **Community Feed (`Dashboard.tsx`, `firestoreService`)**:
   - Localized feed based on user society/locality.
   - **New**: Like/Comment reactions and auto-hide reporting logic.

## External API Integrations
- **Firebase Auth**: `firebase/auth` SDK.
- **Firestore**: `firebase/firestore` (Real-time snapshots for Chat and Feed).
- **Cloudinary**: `https://api.cloudinary.com/v1_1/` for image uploads.
- **FCM**: `firebase/messaging` for browser notifications (WIP/Partial).

## Security Integration Boundary
- **Mirror System**: Data strictly separated between `users` (Private/Internal) and `publicProfiles` (Public/Neighbor-safe).
- **Escrow**: `coinService` ensures coins are only released upon booking completion, preventing chargeback/scam loops.
