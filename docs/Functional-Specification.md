# ProNeighbor Functional Specification

> **Version**: 1.1 | **Last Updated**: June 29, 2026 | **Status**: Production-Ready

---

## Executive Summary

ProNeighbor is a **gated-community service marketplace PWA** that connects verified residents with local professionals. The platform uses a proprietary virtual currency called **NeighbourCoins (NC)** for transactions, with a dual-bucket wallet system that separates cashable (real-money sourced) coins from promotional (earned) coins.

### Product Vision
Enable trusted, hyperlocal service exchanges within gated communities through a secure, community-driven platform that prioritizes verification, transparency, and neighborhood engagement.

### Target Users
1. **Residents**: Individuals living in gated communities seeking local services
2. **Professionals**: Service providers offering skills within their community
3. **Administrators**: Platform operators managing the marketplace

---

## System Overview

### Platform Type
Progressive Web Application (PWA) with mobile-first responsive design

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **State Management**: TanStack Query (React Query), Context API
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions, Messaging)
- **Payments**: Razorpay (coin top-ups)
- **Media**: Cloudinary (image/video uploads)
- **Monitoring**: Sentry (error tracking, performance monitoring)
- **Testing**: Vitest (unit/integration), Playwright (E2E)

### Deployment
- Firebase Hosting (PWA assets)
- Firebase Firestore (NoSQL database)
- Firebase Cloud Functions (serverless backend)
- Firebase Storage (file uploads)

---

## User Roles & Personas

### Role 1: Resident (Default)

**Persona**: Ravi, 35, software engineer living in Prestige Society
**Goals**:
- Find trusted local professionals (plumbers, tutors, yoga instructors)
- Book services quickly with secure payment
- Track booking history and manage appointments
- Earn rewards through referrals and reviews

**Key Features**:
- Browse professionals by category, locality, rating
- Book services with escrow protection
- Real-time chat with professionals
- Wallet management (buy, earn, withdraw NC)
- Review and rate completed services
- Community feed engagement

---

### Role 2: Professional (Opt-in)

**Persona**: Priya, 28, yoga instructor offering classes in her society
**Goals**:
- List services and attract local clients
- Manage bookings and availability
- Earn income through service delivery
- Build reputation through reviews
- Withdraw earnings to bank account

**Key Features**:
- Create and manage service listings
- Set availability calendar
- Accept/reject booking requests
- Track earnings and payout to UPI
- Respond to reviews and build reputation
- Subscribe to Business category listings

---

### Role 3: Administrator

**Persona**: Admin Team, platform operators
**Goals**:
- Ensure platform quality and safety
- Manage users and professionals
- Moderate content and services
- Process payouts and disputes
- Monitor platform health and metrics

**Key Features**:
- User management (roles, verification, disable/delete)
- Service moderation (approve/reject/feature)
- Financial oversight (payouts, adjustments, economy summary)
- Subscription management (comp, pause, cancel)
- Audit trail and compliance
- Platform configuration (categories, pricing, settings)

---

## Feature Inventory

### Module 1: Authentication & Identity

#### F1.1: Email/Password Authentication
**Description**: Users can sign up and sign in using email and password
**Requirements**:
- Email validation (format, uniqueness)
- Password strength requirements (min 8 chars, mixed case, numbers)
- Email verification required before full access
- Password reset via email link

**User Stories**:
- As a new user, I want to create an account with my email so I can access the platform
- As a registered user, I want to reset my password if I forget it

#### F1.2: Google OAuth Authentication
**Description**: Users can sign in using their Google account
**Requirements**:
- One-click sign-in with Google
- Automatic profile creation on first sign-in
- Link Google account to existing email account (future)

**User Stories**:
- As a user, I want to sign in with Google for faster access

#### F1.3: Phone OTP Authentication
**Description**: Users can sign in using phone number with OTP verification
**Requirements**:
- Indian mobile number validation (+91 format)
- OTP sent via SMS
- OTP expiry (5 minutes)
- Rate limiting (max 3 attempts per 10 minutes)

**User Stories**:
- As a user without email, I want to sign in with my phone number

#### F1.4: Profile Management
**Description**: Users can create and update their profile information
**Requirements**:
- Display name (required, 2-100 chars)
- Phone number (optional, Indian format)
- Bio (optional, max 500 chars)
- Profile photo (optional, max 5MB)
- Skills array (for professionals)
- Hourly rate (for professionals)
- Society, locality, tower, flat number (for residency verification)

**User Stories**:
- As a user, I want to update my profile information
- As a professional, I want to showcase my skills and pricing

#### F1.5: Residency Verification
**Description**: Users can verify their residency in a gated community
**Requirements**:
- Upload residency proof (PDF/image, max 10MB)
- Verification status: none → pending → verified
- Admin review workflow (approve/reject with note)
- Verification badge on profile
- Public display of verification status

**User Stories**:
- As a resident, I want to verify my residency to build trust
- As an admin, I want to review residency proofs to ensure safety

#### F1.6: Referral System
**Description**: Users can refer friends and earn rewards
**Requirements**:
- Unique referral code per user (format: PN + 6 alphanumeric chars)
- Referrer earns 200 NC when referred user signs up
- Referred user earns 200 NC on first completed booking
- Referral tracking and history
- Share referral code via link or copy

**User Stories**:
- As a user, I want to refer friends and earn rewards
- As a new user, I want to enter a referral code during signup

#### F1.7: Account Deletion
**Description**: Users can delete their accounts
**Requirements**:
- Soft-delete (anonymize data, mark as deleted)
- Re-authentication required (password for email users)
- Cascade delete across related data (future: hard delete)
- Confirmation dialog with warning

**User Stories**:
- As a user, I want to delete my account if I no longer use the platform

---

### Module 2: Service Marketplace

#### F2.1: Service Discovery (Browse)
**Description**: Residents can browse and search for professionals
**Requirements**:
- Filter by category, locality, society, tower
- Sort by rating, review count, newest
- Search by keyword (service name, skills)
- Pagination (20 items per page)
- Infinite scroll or "Load More" button
- Empty state with suggestions

**User Stories**:
- As a resident, I want to find professionals in my society
- As a resident, I want to filter by category to find specific services

#### F2.2: Professional Detail View
**Description**: Residents can view detailed information about a professional
**Requirements**:
- Profile photo, name, verification badge
- Bio, skills, hourly rate
- Rating and review count
- Review distribution (5-star histogram)
- Recent reviews (with pagination)
- Availability calendar
- Contact button (opens chat if booking exists)
- Book Now button (navigates to booking flow)

**User Stories**:
- As a resident, I want to see a professional's qualifications and reviews
- As a resident, I want to check availability before booking

#### F2.3: Service Listing Management (Professional)
**Description**: Professionals can create and manage their service listings
**Requirements**:
- Create service with title, description, category, price, duration
- Edit existing services
- Delete services
- Service status: pending → approved/featured/rejected
- Business category requires active subscription
- Moderation queue for new services

**User Stories**:
- As a professional, I want to list my services to attract clients
- As a professional, I want to update my service details

#### F2.4: Service Moderation (Admin)
**Description**: Admins can moderate service listings
**Requirements**:
- View all services with filters (status, category, user)
- Approve/reject/feature services
- Add admin notes and moderation reason
- Bulk actions (approve multiple)
- Export to CSV
- Category management (add/remove/rename)

**User Stories**:
- As an admin, I want to ensure service quality through moderation
- As an admin, I want to manage service categories

#### F2.5: Community Feed
**Description**: Users can post updates and engage with community
**Requirements**:
- Create post with text content
- View feed filtered by locality
- React to posts (clap, thumb)
- Report inappropriate posts
- Delete own posts
- Real-time updates (onSnapshot)

**User Stories**:
- As a resident, I want to share updates with my community
- As a resident, I want to see what's happening in my locality

---

### Module 3: Booking System

#### F3.1: Booking Creation
**Description**: Residents can book services from professionals
**Requirements**:
- Select service, date, time slot
- Check availability (no double-booking)
- Calculate total cost (base price + platform fee)
- Hold escrow (deduct coins from wallet)
- Add notes (optional, max 500 chars)
- Upload attachment (optional, max 20MB)
- Create booking with status "pending"

**User Stories**:
- As a resident, I want to book a service at a convenient time
- As a resident, I want to pay securely with escrow protection

#### F3.2: Booking Confirmation (Professional)
**Description**: Professionals can confirm booking requests
**Requirements**:
- View pending bookings
- Confirm or decline bookings
- Add confirmation notes
- Notify client of confirmation
- Update booking status to "confirmed"

**User Stories**:
- As a professional, I want to accept booking requests
- As a professional, I want to decline bookings if unavailable

#### F3.3: Booking Completion (Professional)
**Description**: Professionals can mark bookings as completed
**Requirements**:
- Mark booking as completed after service delivery
- Release escrow (credit coins to professional, minus 15% platform fee)
- Notify client to review
- Update booking status to "completed"
- Upload proof of service (optional)

**User Stories**:
- As a professional, I want to mark bookings as completed to receive payment
- As a professional, I want to upload proof of service

#### F3.4: Booking Cancellation
**Description**: Either party can cancel bookings
**Requirements**:
- Cancel from "pending" or "confirmed" status
- Refund escrow to client (if held)
- Add cancellation reason (optional)
- Notify other party
- Update booking status to "cancelled"

**User Stories**:
- As a resident, I want to cancel a booking if plans change
- As a professional, I want to decline a booking if I can't fulfill it

#### F3.5: Booking Review (Client)
**Description**: Clients can review completed bookings
**Requirements**:
- Rate service (1-5 stars)
- Write comment (max 1000 chars)
- Submit review after "completed" status
- Earn 20 NC for review
- Trigger rating recalculation for professional
- Update booking status to "reviewed"

**User Stories**:
- As a resident, I want to review services to help others
- As a resident, I want to earn rewards for writing reviews

#### F3.6: Booking History
**Description**: Users can view their booking history
**Requirements**:
- View all bookings (client and professional)
- Filter by status (pending, confirmed, completed, cancelled, reviewed)
- Sort by date (newest first)
- Pagination
- Booking detail view

**User Stories**:
- As a user, I want to see my booking history
- As a user, I want to track the status of my bookings

#### F3.7: Real-Time Messaging
**Description**: Users can chat about bookings
**Requirements**:
- Deterministic conversation ID (based on participants + booking)
- Send text messages
- Send attachments (images, PDFs, max 20MB)
- Real-time message delivery (onSnapshot)
- Read receipts (lastReadAt per participant)
- Unread count indicator
- Conversation list with last message preview

**User Stories**:
- As a user, I want to chat with the other party about a booking
- As a user, I want to share files related to the booking

---

### Module 4: Wallet & NeighbourCoins

#### F4.1: Wallet Overview
**Description**: Users can view their coin balances
**Requirements**:
- Display total coin balance
- Display cashable balance (withdrawable)
- Display promo balance (non-withdrawable)
- Transaction history (ledger)
- Filter by transaction type
- Pagination

**User Stories**:
- As a user, I want to see my coin balances
- As a user, I want to see my transaction history

#### F4.2: Coin Top-Up (Purchase)
**Description**: Users can buy coins with real money
**Requirements**:
- Select coin pack (Trial, Starter, Popular, Pro, Society)
- Razorpay payment integration
- Server-side order creation (security)
- Webhook verification (server-side)
- Credit coins after payment success
- Ledger entry (type: topup)
- Receipt generation

**Coin Packs**:
| Pack | Price (₹) | Coins | Bonus | Total |
|------|-----------|-------|-------|-------|
| Trial | 300 | 300 | 0 | 300 |
| Starter | 1000 | 1000 | 100 | 1100 |
| Popular | 1500 | 1500 | 200 | 1700 |
| Pro | 2000 | 2000 | 250 | 2250 |
| Society | 2500 | 2500 | 500 | 3000 |

**User Stories**:
- As a user, I want to buy coins to book services
- As a user, I want to choose a coin pack that fits my budget

#### F4.3: Earning Coins
**Description**: Users can earn coins through various activities
**Requirements**:
- Signup bonus: 500 NC (one-time)
- Profile completion: 50 NC (one-time)
- Referral reward: 200 NC (split flow)
- Review submission: 20 NC (per review)
- Free consultation given: 100 NC (per booking)
- Group session attended: 25 NC
- On-demand request fulfilled: 50 NC
- Community milestone: 50 NC
- Admin credit: variable

**User Stories**:
- As a user, I want to earn coins through referrals
- As a user, I want to earn coins by writing reviews

#### F4.4: Payout to Bank (Withdrawal)
**Description**: Professionals can withdraw earnings to bank account
**Requirements**:
- Minimum payout: 200 NC
- UPI ID validation
- UPI masking for privacy
- Payout request creation
- Admin approval workflow
- Status tracking (pending → processed/failed)
- Ledger entry (type: payout)
- Sentinel lock (prevent duplicate requests)

**User Stories**:
- As a professional, I want to withdraw my earnings to my bank account
- As a professional, I want to track my payout status

#### F4.5: Transaction History (Ledger)
**Description**: Users can view detailed transaction history
**Requirements**:
- List all ledger entries (newest first)
- Display transaction type, amount, balance after, description
- Filter by transaction type
- Pagination
- Export to CSV (future)

**Ledger Entry Types**:
- `topup` — Coin purchase
- `booking_escrow` — Coins held for booking
- `booking_escrow_release` — Earnings from completed booking
- `booking_refund` — Refund from cancelled booking
- `earn_signup_bonus` — Welcome bonus
- `earn_profile` — Profile completion reward
- `earn_referral` — Referral reward
- `earn_review` — Review submission reward
- `payout` — Payout to bank
- `admin_credit` — Admin manual credit
- `subscription_debit` — Subscription payment

**User Stories**:
- As a user, I want to see detailed transaction history
- As a user, I want to understand where my coins came from and went

---

### Module 5: Subscription System

#### F5.1: Subscription Plans
**Description**: Professionals can subscribe to business listing plans
**Requirements**:
- View available plans (3-month, 6-month, 12-month)
- Compare pricing and features
- Select plan for purchase

**Plans**:
| Plan | Duration | Price (NC) | Monthly Effective |
|------|----------|------------|-------------------|
| 3 Months | 90 days | 999 | 333/mo |
| 6 Months | 180 days | 1799 | 300/mo |
| 12 Months | 365 days | 2299 | 192/mo |

**User Stories**:
- As a professional, I want to see subscription plans and pricing
- As a professional, I want to choose a plan that fits my needs

#### F5.2: Free Trial
**Description**: First-time subscribers can activate a free trial
**Requirements**:
- 30-day free trial (one-time per user)
- Full access to business category listings
- Trial status tracking
- Reminder notifications (T-7, T-3, T-1)
- Conversion to paid plan

**User Stories**:
- As a professional, I want to try business listings before paying
- As a professional, I want to be reminded before my trial ends

#### F5.3: Subscription Purchase
**Description**: Professionals can purchase subscriptions with NC
**Requirements**:
- Cashable balance only (no promo coins)
- Server-side debit (Cloud Function)
- Idempotency (prevent duplicate charges)
- Invoice generation
- Ledger entry (type: subscription_debit)
- Restore paused listings

**User Stories**:
- As a professional, I want to purchase a subscription with my coins
- As a professional, I want to receive an invoice for my purchase

#### F5.4: Subscription Management
**Description**: Professionals can manage their subscriptions
**Requirements**:
- View current subscription status
- View days remaining
- Cancel subscription (cancelAtPeriodEnd)
- Resume cancelled subscription
- View subscription history
- View invoices

**User Stories**:
- As a professional, I want to see my subscription status
- As a professional, I want to cancel my subscription if needed

#### F5.5: Renewal & Expiry
**Description**: System manages subscription lifecycle
**Requirements**:
- Renewal reminders (T-7, T-3, T-1)
- Grace period (5 days past due)
- Auto-pause listings on expiry
- Notification on expiry
- Manual renewal required

**User Stories**:
- As a professional, I want to be reminded before my subscription expires
- As a professional, I want my listings to pause if I don't renew

#### F5.6: Admin Subscription Controls
**Description**: Admins can manage subscriptions
**Requirements**:
- Grant complimentary subscriptions
- Pause subscriptions
- Force-cancel subscriptions
- View all subscriptions
- Filter by status, plan, user
- Audit trail for all actions

**User Stories**:
- As an admin, I want to grant free subscriptions to valued professionals
- As an admin, I want to pause subscriptions for policy violations

---

### Module 6: Admin Governance

#### F6.1: User Management
**Description**: Admins can manage user accounts
**Requirements**:
- View all users with filters (role, status, verification)
- Change user roles (user ↔ admin)
- Disable/enable accounts
- Delete accounts (soft-delete)
- View user details and activity
- Residency verification queue

**User Stories**:
- As an admin, I want to manage user accounts
- As an admin, I want to verify residency proofs

#### F6.2: Service Moderation
**Description**: Admins can moderate service listings
**Requirements**:
- View all services with filters
- Approve/reject/feature services
- Add moderation notes
- Bulk actions
- Category management

**User Stories**:
- As an admin, I want to ensure service quality
- As an admin, I want to manage service categories

#### F6.3: Financial Oversight
**Description**: Admins can manage platform finances
**Requirements**:
- View all payouts (pending, processed, failed)
- Process payouts (mark as processed/failed)
- Adjust user coins (credit/debit)
- View coin economy summary
- View transaction history

**User Stories**:
- As an admin, I want to process payout requests
- As an admin, I want to adjust user coins for corrections

#### F6.4: Booking Management
**Description**: Admins can oversee bookings
**Requirements**:
- View all bookings with filters
- View booking details
- Intervene in disputes
- Force-cancel bookings
- Export booking data

**User Stories**:
- As an admin, I want to monitor all bookings
- As an admin, I want to resolve booking disputes

#### F6.5: Subscription Management
**Description**: Admins can manage subscriptions
**Requirements**:
- View all subscriptions
- Grant/revoke subscriptions
- Pause/force-cancel
- View subscription KPIs

**User Stories**:
- As an admin, I want to manage subscriptions
- As an admin, I want to view subscription metrics

#### F6.6: Support Tickets
**Description**: Admins can manage support tickets
**Requirements**:
- View all tickets (open, in_progress, resolved, closed)
- Assign tickets to admins
- Respond to tickets
- Update ticket status
- Ticket numbering (NP + date + sequence)

**User Stories**:
- As an admin, I want to respond to user support requests
- As an admin, I want to track ticket resolution

#### F6.7: Dispute Resolution
**Description**: Admins can resolve booking disputes
**Requirements**:
- View all disputes
- Update dispute status
- Add admin notes
- Resolve in favor of client or professional
- Dismiss frivolous disputes

**User Stories**:
- As an admin, I want to resolve disputes between users
- As an admin, I want to document dispute resolutions

#### F6.8: Audit Trail
**Description**: System logs all admin actions
**Requirements**:
- Append-only audit log
- Log admin ID, action, target, details, metadata
- View audit log with filters
- Export audit log
- Prevent self-targeting on sensitive actions

**User Stories**:
- As an admin, I want to see a record of all admin actions
- As a compliance officer, I want to audit admin activity

#### F6.9: Platform Configuration
**Description**: Admins can configure platform settings
**Requirements**:
- Service categories (add/remove/rename)
- Commission rate (default 15%)
- Subscription pricing
- Grace period duration
- Cron enable/disable
- NC terms (expiry, refund policy, earn cap)

**User Stories**:
- As an admin, I want to configure platform settings
- As an admin, I want to adjust pricing and policies

#### F6.10: Broadcast Notifications
**Description**: Admins can send broadcast notifications
**Requirements**:
- Create broadcast message
- Target all users or specific segments
- Schedule broadcast (future)
- Track delivery status

**User Stories**:
- As an admin, I want to announce platform updates
- As an admin, I want to send important notifications

---

### Module 7: PWA & User Experience

#### F7.1: Progressive Web App
**Description**: Platform is installable as a PWA
**Requirements**:
- Service worker for offline support
- Web app manifest
- Install prompt banner
- Splash screen on launch
- App shortcuts

**User Stories**:
- As a user, I want to install the app on my phone
- As a user, I want the app to work offline

#### F7.2: Push Notifications
**Description**: Users receive push notifications
**Requirements**:
- Request notification permission
- Register FCM token
- Foreground notifications (in-app)
- Background notifications (service worker)
- Notification types: booking, message, wallet, subscription

**User Stories**:
- As a user, I want to receive notifications for important updates
- As a user, I want to be notified when I receive a message

#### F7.3: Responsive Design
**Description**: Platform works on all device sizes
**Requirements**:
- Mobile-first design
- Tablet optimization
- Desktop optimization
- Touch-friendly UI
- Responsive images

**User Stories**:
- As a user, I want the app to work well on my phone
- As a user, I want the app to work well on my tablet

#### F7.4: Dark Mode
**Description**: Users can switch between light and dark themes
**Requirements**:
- Toggle dark mode
- Persist preference
- System preference detection
- Smooth transitions

**User Stories**:
- As a user, I want to use dark mode at night
- As a user, I want my theme preference to be remembered

#### F7.5: Accessibility
**Description**: Platform is accessible to all users
**Requirements**:
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Color contrast ratios
- Focus indicators

**User Stories**:
- As a user with disabilities, I want to use the platform
- As a user, I want to navigate with keyboard only

---

## Non-Functional Requirements

### NFR1: Performance
- Page load time: < 3 seconds (3G)
- Time to interactive: < 5 seconds (3G)
- API response time: < 500ms (p95)
- Firestore query time: < 200ms (p95)
- Lighthouse score: > 90 (Performance)

### NFR2: Scalability
- Support 10,000 concurrent users
- Support 100,000 registered users
- Support 1,000,000 bookings per month
- Horizontal scaling (Firebase auto-scales)

### NFR3: Security
- HTTPS everywhere
- Firebase security rules (defense in depth)
- Input validation (Zod schemas)
- XSS prevention (DOMPurify)
- CSRF protection (Firebase handles)
- Rate limiting (activity logs, API calls)
- Audit trail for admin actions
- Data encryption at rest (Firebase default)
- Data encryption in transit (HTTPS)

### NFR4: Reliability
- 99.9% uptime SLA
- Automatic backups (Firebase default)
- Disaster recovery plan
- Error tracking (Sentry)
- Graceful degradation (offline mode)

### NFR5: Maintainability
- TypeScript for type safety
- Modular architecture (service layer)
- Code coverage > 80%
- Documentation (inline + docs/)
- CI/CD pipeline (GitHub Actions)
- Automated testing (unit, integration, E2E)

### NFR6: Usability
- Intuitive UI/UX
- Consistent design system
- Clear error messages
- Helpful empty states
- Onboarding flow
- Help documentation (FAQ)

### NFR7: Compliance
- GDPR compliance (data export, deletion)
- Indian IT Act compliance
- Privacy policy
- Terms of service
- Cookie consent (future)
- Data retention policy

---

## Data Model Specification

### Collection: users
```typescript
{
  uid: string;                    // Firebase Auth UID
  displayName: string;            // 2-100 chars
  email: string;                  // Email address
  phoneNumber?: string;           // +91XXXXXXXXXX
  photoURL: string;               // Profile photo URL
  bio: string;                    // Max 500 chars
  skills: string[];               // Array of skills
  hourlyRate: number;             // Hourly rate (if professional)
  isFreeConsultation: boolean;    // Free consultation flag
  society: string;                // Society name
  locality: string;               // Locality name
  tower: string;                  // Tower name
  flatNumber: string;             // Flat number
  residencyProofUrl?: string;     // Residency proof URL
  residencyProofPreviewUrl?: string; // PDF preview URL
  residentVerificationStatus: "none" | "pending" | "verified";
  verificationReviewNote?: string; // Admin note
  verificationMethod: "manual" | "auto" | null;
  verificationReviewedBy?: string; // Admin UID
  verificationReviewedAt?: Timestamp;
  verificationSubmittedAt?: Timestamp;
  isServiceProvider: boolean;     // Professional flag
  priceAfterQuote: boolean;       // Quote-based pricing
  role: "user" | "admin";         // User role
  rating: number;                 // Average rating (0-5)
  reviewCount: number;            // Number of reviews
  coinBalance: number;            // Total coin balance
  cashableBalance: number;        // Withdrawable balance
  promoBalance: number;           // Non-withdrawable balance
  referralCode: string;           // Unique referral code
  emailVisible: boolean;          // Show email publicly
  phoneVisible: boolean;          // Show phone publicly
  flatVisible: boolean;           // Show flat publicly
  deleted: boolean;               // Soft-delete flag
  disabled: boolean;              // Account disabled flag
  fcmToken?: string;              // FCM push token
  subscription?: {                // Denormalized subscription
    status: string;
    currentPeriodEnd: Timestamp;
    plan: string;
    trialUsed: boolean;
    cancelAtPeriodEnd: boolean;
  };
  trialUsed: boolean;             // Trial used flag
  recentlyViewedPros: string[];   // Recently viewed pro UIDs
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: publicProfiles
```typescript
{
  uid: string;                    // Same as users/{uid}
  displayName: string;
  photoURL: string;
  bio: string;
  skills: string[];
  isServiceProvider: boolean;
  rating: number;
  reviewCount: number;
  society: string;
  locality: string;
  tower: string;
  hourlyRate: number;
  isFreeConsultation: boolean;
  priceAfterQuote: boolean;
  role: "user" | "admin";
  disabled: boolean;
  email?: string;                 // Only if emailVisible
  phoneNumber?: string;           // Only if phoneVisible
  flatNumber?: string;            // Only if flatVisible
  residencyProofUrl?: string;
  residentVerificationStatus: "none" | "pending" | "verified";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: services
```typescript
{
  id: string;                     // Auto-generated
  userId: string;                 // Professional UID
  title: string;                  // 1-100 chars
  description: string;            // Service description
  price: number;                  // Price in NC
  isFree: boolean;                // Free service flag
  quoteBased: boolean;            // Quote-based pricing
  duration: string;               // Service duration
  category: string;               // Service category
  status: "pending" | "approved" | "featured" | "rejected";
  moderationReason?: string;      // Admin note
  moderatedBy?: string;           // Admin UID
  moderatedAt?: Timestamp;
  adminNotes?: string;
  subStatus?: "paused_subscription" | null; // Subscription pause
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: bookings
```typescript
{
  id: string;                     // Auto-generated
  clientId: string;               // Client UID
  clientUid: string;              // Client UID (legacy)
  proId: string;                  // Professional UID
  proUid: string;                 // Professional UID (legacy)
  serviceName: string;
  serviceId?: string;
  serviceCategory?: string;
  amount: number;                 // Base price
  escrowCoins: number;            // Total held
  escrowStatus: "none" | "held" | "released" | "refunded";
  coinsPaid: boolean;
  paidInCoins?: number;
  status: "pending" | "confirmed" | "completed" | "reviewed" | "cancelled";
  date: string;                   // YYYY-MM-DD
  timeSlot?: string;              // e.g., "10:00 AM - 11:00 AM"
  notes?: string;                 // Max 500 chars
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  platformFee?: number;           // 15% default
  proEarning?: number;            // 85% default
  commissionRate?: number;        // Percentage * 100
  confirmedAt?: Timestamp;
  confirmedBy?: string;
  completedAt?: Timestamp;
  completedBy?: string;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  cancellationComment?: string;
  cancellationCommentBy?: string;
  cancellationCommentRole?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: coinLedger/{uid}/entries
```typescript
{
  id: string;                     // Deterministic ID
  uid: string;                    // User UID
  type: LedgerType;               // Transaction type
  amount: number;                 // Positive or negative
  balanceAfter: number;           // Balance after transaction
  description: string;            // Human-readable
  refId?: string;                 // Reference ID
  createdAt: Timestamp;
}

type LedgerType =
  | "topup" | "booking_debit" | "booking_refund" | "booking_escrow"
  | "booking_escrow_release" | "payout" | "payout_cancelled"
  | "earn_review" | "earn_referral" | "earn_free_consult" | "earn_profile"
  | "earn_milestone" | "earn_groupsession" | "earn_ondemand" | "earn_signup_bonus"
  | "admin_credit" | "admin_debit" | "subscription_debit";
```

### Collection: subscriptions
```typescript
{
  id: string;                     // sub_{uid}_{monthKey}
  uid: string;                    // User UID
  plan: PlanId;                   // Plan ID
  status: SubscriptionStatus;     // Subscription status
  currency: "NC" | "free";        // Currency type
  amount: number;                 // Amount paid
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  cancelAtPeriodEnd: boolean;
  lastInvoiceId?: string;
  source: "trial" | "coins" | "comp" | "admin_grant";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type PlanId = "business_trial_v1" | "business_3m_v1" | "business_6m_v1" | "business_12m_v1";
type SubscriptionStatus = "trial" | "trial_ending" | "active" | "renewing" | "past_due" | "grace" | "expired" | "cancelled" | "comped" | "paused";
```

### Collection: messages/{convId}/chats
```typescript
{
  id: string;                     // Auto-generated
  senderId: string;               // Sender UID
  text: string;                   // Message text
  timestamp: Timestamp;
  read: boolean;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
}
```

### Collection: localFeed
```typescript
{
  id: string;                     // Auto-generated
  authorId: string;               // Author UID
  authorName: string;
  authorPhotoURL?: string;
  content: string;                // Post content
  locality?: string;
  society?: string;
  tower?: string;
  reactions: Record<string, string>; // uid → reaction type
  likes: string[];                // Array of UIDs
  likeCount: number;
  commentCount: number;
  reportCount?: number;
  hidden?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: tickets
```typescript
{
  id: string;                     // Auto-generated
  ticketNumber: string;           // NP + date + sequence
  uid: string;                    // User UID
  displayName: string;
  email: string;
  subject: string;
  category: "general" | "booking" | "payment" | "account" | "dispute" | "other";
  bookingId?: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedAdminId?: string;
  assignedAdminName?: string;
  assignedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
}
```

### Collection: disputes
```typescript
{
  id: string;                     // Auto-generated
  bookingId: string;
  raisedByUid: string;
  raisedByName: string;
  againstUid: string;
  reason: string;
  description: string;
  status: "raised" | "under_review" | "resolved_client" | "resolved_pro" | "dismissed";
  adminNote?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: auditLogs
```typescript
{
  id: string;                     // Auto-generated
  action: string;                 // e.g., "user.role_change"
  adminId: string;                // Admin UID
  adminName: string;              // Admin display name
  details: string;                // Action details
  targetId?: string;              // Target UID
  metadata: Record<string, unknown>; // Additional data
  timestamp: Timestamp;
  createdAt: Timestamp;
}
```

### Collection: activityLogs
```typescript
{
  id: string;                     // Auto-generated
  userId: string;                 // User UID
  event: ActivityEvent;           // Event type
  details: string;                // Event details
  metadata: Record<string, unknown>; // Additional data
  timestamp: Timestamp;
}

type ActivityEvent =
  | "user.login" | "user.logout" | "user.profile_update" | "user.signup"
  | "booking.created" | "booking.cancelled" | "booking.completed"
  | "booking.confirmed" | "booking.reviewed"
  | "payment.initiated" | "payment.success"
  | "message.sent" | "review.submitted"
  | "wallet.topup" | "wallet.withdrawal"
  | "support.ticket_created"
  | "verification.submitted" | "verification.deleted" | "verification.approved"
  | "subscription.purchased" | "subscription.renewed" | "subscription.cancelled"
  | "subscription.expired" | "subscription.paused" | "subscription.comp_granted"
  | "admin.action";
```

---

## Integration Specifications

### Razorpay Integration
**Purpose**: Coin pack top-ups (real money → NC)

**Flow**:
1. Client calls `createRazorpayOrder` Cloud Function
2. Cloud Function creates order via Razorpay API
3. Client opens Razorpay checkout with order_id
4. User completes payment
5. Razorpay webhook fires (server-side verification)
6. Cloud Function credits coins via `topUpCoins()`
7. Ledger entry created (type: "topup")

**Security**:
- Server-side order creation
- Webhook signature verification
- Idempotency via paymentId

**Plan Requirement**: Blaze plan (HTTPS callables + outbound network)

---

### Cloudinary Integration
**Purpose**: Image/video uploads

**Configuration**:
```typescript
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
```

**Upload Folders**:
- `ProNeighbor/profiles` — Profile photos
- `ProNeighbor/residency-proofs` — Residency verification
- `ProNeighbor/bookings` — Booking attachments
- `ProNeighbor/messages/{conversationId}` — Chat attachments

**Validation**:
- File size limits (profile: 5MB, proof: 10MB, attachment: 20MB)
- File type validation (images, PDFs)
- Dimension validation for images

---

### Firebase Cloud Messaging (FCM)
**Purpose**: Push notifications

**Flow**:
1. Client requests notification permission
2. FCM token retrieved via `getToken()`
3. Token saved to `users/{uid}.fcmToken`
4. Cloud Function sends notification via FCM API
5. Service worker handles background messages
6. Foreground messages shown via `onMessage` listener

**Service Worker**: Unified `/sw.js` handles both PWA caching and FCM

---

### Sentry Integration
**Purpose**: Error tracking and performance monitoring

**Configuration**:
```typescript
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

**Usage**:
```typescript
captureError(error, { operation: "topup_coins", uid });
setSentryUser(uid);
```

---

## Security Requirements

### Authentication
- Firebase Auth (email/password, Google OAuth, Phone OTP)
- Email verification required
- Session management (Firebase handles)
- Multi-factor authentication (future)

### Authorization
- Role-based access control (user, admin)
- Firestore security rules (field-level security)
- JWT custom claims for admin (zero Firestore reads)
- Self-targeting prevention for admins

### Data Protection
- HTTPS everywhere
- Encryption at rest (Firebase default)
- Encryption in transit (HTTPS)
- Input validation (Zod schemas)
- XSS prevention (DOMPurify)
- CSRF protection (Firebase handles)

### Audit & Compliance
- Append-only audit log for admin actions
- Activity logging for user actions
- Rate limiting (activity logs, API calls)
- Data export (GDPR)
- Data deletion (GDPR)
- Privacy policy
- Terms of service

---

## Testing Requirements

### Unit Tests (Vitest)
**Coverage**: > 80% statements/lines/functions

**Critical Paths**:
- Coin top-up flow
- Escrow hold/release/refund
- Payout request with sentinel lock
- Booking state transitions
- Referral split flow
- Subscription purchase
- Input validation (Zod schemas)

### Integration Tests
**Scope**: Service layer integration with Firestore

**Critical Paths**:
- Transaction atomicity
- Idempotency on retries
- Concurrent operation handling
- Error handling and recovery

### E2E Tests (Playwright)
**Scope**: Critical user flows

**Test Suites**:
- Authentication (login, signup, forgot password)
- Booking lifecycle (create → confirm → complete → review)
- Wallet operations (top-up, payout)
- Subscription purchase
- Admin operations

---

## Deployment Requirements

### Build Process
```bash
npm run build    # TypeScript check + Vite production build
```

### Deployment Process
```bash
firebase deploy  # Deploy to Firebase Hosting + Functions
```

### Environment Variables
```bash
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_CLOUDINARY_CLOUD_NAME
VITE_CLOUDINARY_UPLOAD_PRESET
VITE_CLOUDINARY_RESIDENCY_UPLOAD_PRESET
VITE_SENTRY_DSN
VITE_FCM_VAPID_KEY
VITE_ENABLE_RAZORPAY_TOPUP
```

### Monitoring
- Sentry error tracking
- Firebase console metrics
- Cloud Function logs
- Firestore usage metrics

---

## Glossary

| Term | Definition |
|------|------------|
| **NC** | NeighbourCoin (1 NC = ₹1) |
| **Cashable Balance** | Real-money sourced coins (withdrawable) |
| **Promo Balance** | Earned bonus coins (non-withdrawable) |
| **Escrow** | Coins held until booking completion |
| **TOCTOU** | Time-of-check-time-of-use (race condition) |
| **Idempotency Key** | Unique identifier to prevent duplicate processing |
| **Sentinel Document** | Lock mechanism for concurrent operation prevention |
| **Blaze Plan** | Firebase pay-as-you-go plan (required for Cloud Functions) |
| **Spark Plan** | Firebase free tier (limited Cloud Functions) |
| **PWA** | Progressive Web App (installable web application) |
| **FCM** | Firebase Cloud Messaging (push notifications) |
| **RBAC** | Role-Based Access Control |
| **Zod** | TypeScript-first schema validation library |
| **TanStack Query** | Data fetching and caching library (formerly React Query) |
| **Vite** | Fast build tool and dev server |
| **MSW** | Mock Service Worker (API mocking for tests) |

---

## References

- **docs/architecture.md**: System architecture overview
- **docs/order-flow.md**: Booking lifecycle documentation
- **docs/strategies/options-engine.md**: Subscription engine documentation
- **docs/AGoT-playbook.md**: Reasoning framework and decision guides
- **docs/USER-GUIDE.md**: End-user documentation
- **firestore.rules**: Security rules (single source of truth for access control)
- **functions/src/**: Cloud Functions implementation
- **src/services/**: Service layer implementations
