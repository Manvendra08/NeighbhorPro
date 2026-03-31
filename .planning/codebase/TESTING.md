# TESTING.md - Verification Strategy

## Primary Test Mode
**E2E (End-to-End)**:
- **Visual Verification**: Use `browser_mcp` or `playwright` (MCP based) for visual regression.
- **Manual QA**: Resident/Pro personas utilized for regression testing after major feature adds (Wallet, Identity, Feed).

## Build-Time Checks
- `npm run build`: Runs `tsc` (Type Checking) and `vite build` (Bundling).
- **Security Check**: `firebase deploy --only firestore:rules` validates Firestore syntax.

## Automated Testing (WIP/Partial)
- **Unit Tests**: Minimum presence in current codebase.
- **Integration Tests**: Inferred via successful production builds.
- **TDD Requirement**: Use `tdd-workflow` skill for new critical features (especially logic-heavy services like `coinService`).

## Deployment Gates
1. `npm run build` MUST pass.
2. `git add .` + `git commit` to maintain version history.
3. `firebase deploy` once visual verification is complete.
