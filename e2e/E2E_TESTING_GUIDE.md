## ProNeighbor E2E Testing Guide

**Playwright-based End-to-End Tests**

---

## 📋 Overview

This directory contains comprehensive end-to-end tests for ProNeighbor using Playwright. The tests cover three main user flows:

1. **Signup Flow** - User registration and account creation
2. **Login Flow** - User authentication and session management
3. **Complete Booking Flow** - Full booking workflow from browse to confirmation

---

## 🚀 Quick Start

### Prerequisites

```bash
# Ensure Node.js and npm are installed
node --version
npm --version
```

### Installation

```bash
# Install dependencies (if not already installed)
npm install

# Install Playwright browsers
npx playwright install
```

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/signup-flow.spec.ts

# Run tests in headed mode (visible browser)
npx playwright test --headed

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

---

## 📁 Test Files

### signup-flow.spec.ts
**Tests user registration and account creation**

**Test Cases:**
- ✓ Display registration page correctly
- ✓ Show validation errors for empty form
- ✓ Show error for invalid email format
- ✓ Show error for password mismatch
- ✓ Successfully register a new user
- ✓ Show error for already registered email
- ✓ Have working Google sign-in button
- ✓ Navigate to login page from signup
- ✓ Have accessible form elements
- ✓ Work on mobile viewport

**Duration:** ~2-3 minutes

**Run:**
```bash
npx playwright test e2e/signup-flow.spec.ts
```

---

### login-flow.spec.ts
**Tests user authentication and session management**

**Test Cases:**
- ✓ Display login page correctly
- ✓ Show validation errors for empty form
- ✓ Show error for invalid credentials
- ✓ Successfully login with valid credentials
- ✓ Persist session after login
- ✓ Have working Google sign-in button
- ✓ Navigate to forgot password page
- ✓ Navigate to signup page from login
- ✓ Show/hide password toggle
- ✓ Have accessible form elements
- ✓ Handle network errors gracefully
- ✓ Redirect to dashboard if already logged in
- ✓ Work on mobile viewport

**Duration:** ~3-4 minutes

**Run:**
```bash
npx playwright test e2e/login-flow.spec.ts
```

---

### complete-booking-flow.spec.ts
**Tests the entire booking workflow**

**Test Cases:**
- ✓ Display browse services page
- ✓ View service details
- ✓ Complete full booking flow
- ✓ Show booking form validation
- ✓ Display available time slots for selected date
- ✓ Show booking summary before confirmation
- ✓ Handle insufficient balance gracefully
- ✓ Complete booking on mobile

**Duration:** ~4-5 minutes

**Run:**
```bash
npx playwright test e2e/complete-booking-flow.spec.ts
```

---

## 🔧 Configuration

### playwright.config.ts

The Playwright configuration includes:

- **Base URL:** `http://localhost:5173` (configurable via `E2E_BASE_URL`)
- **Browsers:** Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Timeouts:** 10s action, 30s navigation
- **Retries:** 2 on CI, 0 locally
- **Screenshots:** On failure only
- **Videos:** On failure only
- **Traces:** On first retry

### Environment Variables

```bash
# Set custom base URL
export E2E_BASE_URL=https://staging.proneighbor.com

# Run tests
npm run test:e2e
```

---

## 📊 Test Reports

### HTML Report

After running tests, view the HTML report:

```bash
npx playwright show-report
```

This opens an interactive report showing:
- Test results
- Screenshots
- Videos
- Traces
- Execution times

### CI/CD Reports

On CI, reports are generated in:
- GitHub Actions format
- HTML format (saved as artifact)

---

## 🐛 Debugging

### Debug Mode

```bash
# Run tests in debug mode
npx playwright test --debug

# Debug specific test
npx playwright test e2e/login-flow.spec.ts --debug
```

### UI Mode (Recommended)

```bash
# Run tests in UI mode
npm run test:e2e:ui
```

UI mode provides:
- Interactive test execution
- Time travel debugging
- Watch mode
- Test picker
- Trace viewer

### Trace Viewer

```bash
# View trace for failed test
npx playwright show-trace test-results/.../trace.zip
```

---

## 📝 Writing Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/page');
  });

  test('should do something', async ({ page }) => {
    // Test implementation
    await page.locator('button').click();
    await expect(page.locator('h1')).toHaveText('Expected Text');
  });
});
```

### Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Wait for elements** before interacting
3. **Use expect assertions** for verification
4. **Keep tests independent** - each test should work standalone
5. **Use page object pattern** for complex pages
6. **Handle async operations** properly
7. **Clean up after tests** if needed

### Common Patterns

```typescript
// Wait for navigation
await page.waitForURL(/\/dashboard/);

// Wait for element
await page.waitForSelector('button');

// Fill form
await page.locator('input[type="email"]').fill('test@example.com');

// Click button
await page.locator('button:has-text("Submit")').click();

// Assert text
await expect(page.locator('h1')).toHaveText('Welcome');

// Assert URL
await expect(page).toHaveURL(/\/dashboard/);

// Assert visibility
await expect(page.locator('button')).toBeVisible();

// Take screenshot
await page.screenshot({ path: 'screenshot.png' });
```

---

## 🎯 Test Data

### Test Accounts

Create test accounts before running tests:

```typescript
// Signup test creates unique accounts
const testEmail = `testuser_${Date.now()}@proneighbor.test`;

// Login test uses existing account
const testEmail = 'test@proneighbor.test';
const testPassword = 'TestPassword123!';
```

### Test Services

Ensure test services exist in the database:
- At least one service for booking tests
- Services with different price points
- Services with available time slots

---

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: playwright-report
          path: playwright-report/
```

### GitLab CI

```yaml
e2e-tests:
  image: mcr.microsoft.com/playwright:latest
  script:
    - npm ci
    - npx playwright install
    - npm run test:e2e
  artifacts:
    when: always
    paths:
      - playwright-report/
```

---

## 📈 Performance

### Test Execution Times

| Test Suite | Duration | Tests |
|------------|----------|-------|
| Signup Flow | ~2-3 min | 10 tests |
| Login Flow | ~3-4 min | 13 tests |
| Booking Flow | ~4-5 min | 8 tests |
| **Total** | **~10-12 min** | **31 tests** |

### Optimization Tips

1. **Run tests in parallel** (default in Playwright)
2. **Use test fixtures** for common setup
3. **Reuse authentication state** across tests
4. **Skip unnecessary waits** with proper selectors
5. **Use headed mode only for debugging**

---

## 🔍 Troubleshooting

### Issue: Tests fail with "Timeout"

**Solution:**
```bash
# Increase timeout
npx playwright test --timeout=60000

# Or in test file
test.setTimeout(60000);
```

### Issue: "Element not found"

**Solution:**
```typescript
// Wait for element before interacting
await page.waitForSelector('button');
await page.locator('button').click();

// Or use auto-waiting
await page.locator('button').click(); // Auto-waits
```

### Issue: "Navigation timeout"

**Solution:**
```typescript
// Increase navigation timeout
await page.goto('/page', { timeout: 60000 });

// Or wait for specific state
await page.goto('/page', { waitUntil: 'networkidle' });
```

### Issue: Tests pass locally but fail on CI

**Solution:**
- Check environment variables
- Ensure database is seeded
- Verify network connectivity
- Check for timing issues
- Review CI logs and screenshots

### Issue: "Browser not found"

**Solution:**
```bash
# Install browsers
npx playwright install

# Install with system dependencies
npx playwright install --with-deps
```

---

## 📚 Resources

### Documentation
- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)

### Examples
- [Playwright Examples](https://github.com/microsoft/playwright/tree/main/examples)
- [Playwright Test Examples](https://github.com/microsoft/playwright/tree/main/tests)

### Tools
- [Playwright Inspector](https://playwright.dev/docs/inspector)
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright Codegen](https://playwright.dev/docs/codegen)

---

## ✅ Checklist

### Before Running Tests
- [ ] ProNeighbor app is running: `npm run dev`
- [ ] Playwright is installed: `npx playwright install`
- [ ] Test accounts exist in database
- [ ] Test services are available
- [ ] Database is in clean state

### After Running Tests
- [ ] Review test results
- [ ] Check screenshots for failures
- [ ] Review videos for failures
- [ ] Check traces for debugging
- [ ] Document any issues found

---

## 🎯 Next Steps

### Expand Test Coverage
1. Add tests for wallet functionality
2. Add tests for messaging
3. Add tests for admin panel
4. Add tests for profile management
5. Add tests for reviews and ratings

### Improve Tests
1. Add page object models
2. Add test fixtures
3. Add custom matchers
4. Add visual regression tests
5. Add accessibility tests

### CI/CD Integration
1. Set up automated test runs
2. Add test reports to PR comments
3. Set up test result notifications
4. Add performance benchmarks
5. Set up test coverage tracking

---

**Created:** May 4, 2026  
**Status:** Ready for Testing  
**Test Framework:** Playwright  
**Total Tests:** 31 tests across 3 flows
