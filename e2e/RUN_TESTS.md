# Quick Start - Run E2E Tests

## 🚀 Run All Tests

```bash
npm run test:e2e
```

## 🎯 Run Specific Tests

```bash
# Signup flow
npx playwright test e2e/signup-flow.spec.ts

# Login flow
npx playwright test e2e/login-flow.spec.ts

# Booking flow
npx playwright test e2e/complete-booking-flow.spec.ts
```

## 🖥️ Run with UI (Interactive)

```bash
npm run test:e2e:ui
```

## 👀 Run with Visible Browser

```bash
npx playwright test --headed
```

## 🐛 Debug Mode

```bash
npx playwright test --debug
```

## 📊 View Report

```bash
npx playwright show-report
```

## ✅ Prerequisites

1. **Install Playwright:**
   ```bash
   npx playwright install
   ```

2. **Start ProNeighbor:**
   ```bash
   npm run dev
   ```

3. **Create test account:**
   - Email: `test@proneighbor.test`
   - Password: `TestPassword123!`

## 📋 Test Summary

| Test Suite | Tests | Duration |
|------------|-------|----------|
| Signup Flow | 10 | ~2-3 min |
| Login Flow | 13 | ~3-4 min |
| Booking Flow | 8 | ~4-5 min |
| **Total** | **31** | **~10-12 min** |

## 📚 Full Documentation

See `E2E_TESTING_GUIDE.md` for complete documentation.
