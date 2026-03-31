# STACK.md - Technical Stack & Dependencies

## Core Technologies
- **Runtime**: Node.js v18+ (estimated)
- **Frontend Framework**: React 18+
- **Build Tool**: Vite
- **Language**: TypeScript (with strict typing)
- **Styling**: Vanilla CSS (CSS Variables for theming)

## Backend & Infrastructure
- **BaaS**: Firebase (Google Cloud Platform)
  - **Auth**: Firebase Authentication (Email/Password, Google OAuth, Phone OTP/Recaptcha)
  - **Database**: Cloud Firestore (NoSQL, with Public/Private record mirroring)
  - **Hosting**: Firebase Hosting
  - **Security**: Firestore Rules (Custom ACLs)
- **Media**: Cloudinary (Image/Asset management with signed uploads)

## Primary Dependencies
- `firebase`: SDK for core services
- `react-router-dom`: SPA Routing
- `lucide-react`: Iconography
- `framer-motion`: (Optional/Inferred for UI polish)

## Dev Ops & Tooling
- `typescript`: Type checking
- `vite`: Dev server and bundling
- `firebase-tools`: CLI for deployment
- `get-shit-done-cc`: GSD System for AI Agent orchestration
