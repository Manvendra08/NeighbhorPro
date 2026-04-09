# STRUCTURE.md - Folder Map

## Project Root
- `.agent/`: GSD Skill system
- `.planning/`: Context engineering and Specs
- `.firebase/`: Cache for hosting/deploy
- `dist/`: Build output
- `src/`: Core development files
- `public/`: Static assets (logos, manifest)

## src/ Detailed Structure
- `src/assets/`: Styles (`index.css`, `LandingPage.css`) and Icons.
- `src/components/`: Atomic UI units (`Navbar.tsx`, `Sidebar.tsx`, `LoyaltyStreakWidget.tsx`).
- `src/contexts/`: Shared React contexts (`AuthContext.tsx`).
- `src/pages/`: Feature pages and Routing
  - `src/pages/admin/`: Admin Dashboard and Management (Users, Bookings, Tickets).
  - `src/pages/support/`: Customer support and FAQ.
- `src/services/` (The "Model" of the app):
  - `coinService.ts`: Financial transactions.
  - `firestoreService.ts`: General Firestore collection methods.
  - `activityService.ts`: Audit and user logs.
  - `loyaltyService.ts`: Tier and points calculation.
- `src/types/`: TypeScript interfaces and Firestore definitions.
- `src/utils/`: Helper functions (Cloudinary, Dates).

## Key Persistence Files
- `firestore.rules`: Security logic.
- `firebase.json`: CLI configuration.
- `package.json`: Project metadata.
