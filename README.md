# ProNeighbor

ProNeighbor is a gated-community marketplace web application designed to connect residents with verified local professionals. It streamlines the process of browsing, booking, and managing services within a secure, community-focused environment.

## 🚀 Key Features

- **Role-Based Experience**: Tailored interfaces for Residents, Service Professionals, and Admins.
- **Service Marketplace**: Browse and book verified local professionals (plumbers, electricians, etc.).
- **Real-Time Messaging**: In-app chat with deterministic conversation IDs, attachments, and read receipts.
- **Wallet System**: Integrated coin-based wallet with Razorpay support for top-ups.
- **Community Feed**: Post updates, reactions, and reports within the gated society.
- **Residency Verification**: Secure profile management with residency proof upload and verification.
- **Admin Dashboard**: Comprehensive modules for managing users, societies, services, bookings, and audit logs.

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide React, React Router.
- **State Management**: TanStack Query (React Query).
- **Backend/Database**: Firebase (Authentication, Firestore, Storage, Cloud Functions).
- **Payments**: Razorpay SDK.
- **Observability**: Sentry for error tracking and performance monitoring.
- **Testing**: Vitest for unit/integration tests, Playwright for E2E testing.
- **Validation & Security**: Zod for schema validation, DOMPurify for content sanitization.

## 📦 Project Structure

```text
├── src/
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React Contexts (Auth, Theme, etc.)
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Page components (Dashboard, Browse, etc.)
│   ├── services/       # Firebase and API service layers
│   ├── lib/            # Utility libraries and constants
│   └── main.tsx        # Application entry point
├── functions/          # Firebase Cloud Functions (Backend logic)
├── e2e/                # Playwright end-to-end tests
├── scripts/            # Maintenance and seeding scripts
├── public/             # Static assets
└── firestore.rules     # Firestore security rules
```

## 🚥 Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- Firebase Account & Project

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ProNeighbor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Copy `.env.example` to `.env.local` and fill in your Firebase credentials:
   ```bash
   cp .env.example .env.local
   ```

### Development

Start the development server:
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

Preview the production build locally:
```bash
npm run preview
```

### Build

Create a production build:
```bash
npm run build
```

## 🛠 Utilities

Seed test users into the database:
```bash
npm run seed:test-users
```

## 🧪 Testing

- **Unit/Integration Tests**: `npm run test`
- **Watch Mode**: `npm run test:watch`
- **E2E Tests**: `npm run test:e2e`
- **E2E UI**: `npm run test:e2e:ui`

## 💳 Payments And Firebase Plan

- Secure Razorpay top-ups in this project require server-created orders and webhook signature verification.
- That flow depends on Firebase Cloud Functions and is intended for Blaze-ready deployments.
- On Firebase Spark plan, wallet top-ups are intentionally disabled (fail-closed) to prevent insecure client-side crediting.
- To enable top-ups in a Blaze environment, set `VITE_ENABLE_RAZORPAY_TOPUP=true` and deploy payment functions/webhook.

## 🚀 Deployment

The project is configured for Firebase Hosting.

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Deploy: `firebase deploy`

## 📄 License

This project is private and proprietary. All rights reserved.
