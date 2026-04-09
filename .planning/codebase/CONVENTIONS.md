# CONVENTIONS.md - Coding Standards

## Filename Conventions
- **Pages/Components**: PascalCase (e.g., `Dashboard.tsx`, `NavBar.tsx`).
- **Services/Utils**: camelCase (e.g., `coinService.ts`, `authService.ts`).
- **Styles**: kebab-case (e.g., `landing-page.css`).

## Data Pattern: Mirroring
When updating a user's `users` record, ALWAYS call `mirrorPublicProfile` to sync non-sensitive fields to `publicProfiles`.
- **Private Fields**: `phoneNumber`, `email`, `flatNumber`, `coinBalance`, `fcmToken`.
- **Public Fields**: `displayName`, `photoURL`, `bio`, `skills`, `rating`, `locality`, `tower`.

## React/Styling
- **CSS**: Prefer global CSS variables for theming. Avoid Tailwind for new features unless requested.
- **Components**: Functional components only. No class components.
- **Icons**: Lucide for UI, emojis for content (engagement).

## Persistence & Auditing
- **Timestamps**: Always use `serverTimestamp()` from Firebase for `createdAt` and `updatedAt`.
- **Audit Logs**: Record major CRUD operations (Logins, Signup, Booking, Verification) in `auditLog` or `activityLog`.
