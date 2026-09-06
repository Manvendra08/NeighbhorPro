## Description
<!-- Provide a brief description of the changes introduced by this pull request. -->

## Type of Change
- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 🔨 Refactoring / Code cleanup
- [ ] 🧪 Test addition or improvement
- [ ] 🚀 Deployment / CI configuration

## Pre-Merge Quality Checks
- [ ] 
pm run build passed (TypeScript & Vite bundle clean)
- [ ] 
pm run test passed (Vitest unit tests)
- [ ] 
px playwright test --project=chromium passed (E2E browser tests)

## UAT (User Acceptance Testing) Checklist
- [ ] Verified on Desktop viewport
- [ ] Verified on Mobile viewport / PWA standalone mode
- [ ] Tested as **Resident** user
- [ ] Tested as **Service Professional** user
- [ ] Tested as **Admin** user (if applicable)
- [ ] Wallet & NeighbourCoin transactions verified (dual-bucket ledger)
- [ ] Real-time updates verified (chat, booking status changes)
