# CONCERNS.md - Project Risks

## Component Bloat
- `Dashboard.tsx` (800+ lines): Contains Desktop/Mobile layouts and Feed/Composer logic in a single file. Needs refactoring into a component folder (`src/components/dashboard/`).
- `AdminUsers.tsx`: Large admin table with multiple modals and filters.

## Scalability
- **Feed (Local)**: Currently uses `onSnapshot` for real-time feed. As neighbors increase, need to implement pagination properly within `Dashboard.tsx` to handle large feeds.
- **Identity Verification**: Manual approval by admins is currently the only way. As the user base grows, automated KYC/e-Identity integration will be needed.

## Security Boundaries (High Priority)
- **Sensitive Data Isolation**: The new `publicProfiles` system is in place but needs audit to ensure NO page still imports `getUserProfile` for public interaction. 
- **Escrow Integrity**: `coinService.ts` needs thorough testing to prevent "Stuck Escrow" or "Double Release" edge cases.

## Token Efficiency
- Large files like `Dashboard.tsx` and `AdminUsers.tsx` consume significant context tokens during edits. Use `multi_replace_file_content` to minimize token bloat.

## Documentation
- `README.md` and basic project setup docs are minimal. Use `gsd-milestone-summary` at the end of the current milestone to fix this.
