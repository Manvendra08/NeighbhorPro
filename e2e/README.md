# ProNeighbor E2E Testing with Playwright

This directory contains end-to-end (E2E) tests for the ProNeighbor application using [Playwright](https://playwright.dev).

## 📁 Project Structure

```
e2e/
├── fixtures/
│   └── test-fixtures.ts    # Custom test fixtures with page objects
├── pages/
│   ├── base.page.ts        # Base page object with common methods
│   ├── login.page.ts       # Login page object model
│   ├── browse.page.ts      # Browse professionals page object model
│   └── dashboard.page.ts   # Dashboard page object model
├── auth.spec.ts            # Authentication flow tests
├── browse.spec.ts          # Browse & search functionality tests
├── booking-flow.spec.ts    # Complete booking journey tests
├── global-setup.ts         # Global test setup (runs once before all tests)
└── global-teardown.ts      # Global test teardown (runs once after all tests)
```

## 🚀 Getting Started

### Prerequisites

1. Install Playwright browsers (first time only):
   ```bash
   npx playwright install
   ```

2. Configure test environment variables (optional but recommended):
   ```bash
   # Copy example env file
   cp .env.example .env.local
   
   # Add test credentials for authenticated tests
   TEST_RESIDENT_EMAIL=resident@test.proneighbor.app
   TEST_RESIDENT_PASSWORD=Test@123456
   TEST_PROFESSIONAL_EMAIL=pro@test.proneighbor.app
   TEST_PROFESSIONAL_PASSWORD=Test@123456
   ```

### Running Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run tests in a specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox

# Run tests with tracing enabled for debugging
npx playwright test --trace on

# Run tests in headed mode (see browser)
npx playwright test --headed
```

### Test Configuration

The `playwright.config.ts` file configures:

- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Timeouts**: 30s default, 10s for actions
- **Retries**: 2 retries in CI, 0 in local development
- **Screenshots**: Captured only on test failure
- **Traces**: Recorded on first retry for debugging
- **Videos**: Recorded on failure for visual debugging
- **Parallelism**: Full parallel locally, single worker in CI

## 🧩 Page Object Model (POM)

Tests use the Page Object Model pattern for maintainability:

### BasePage (`pages/base.page.ts`)
Common methods and selectors available to all pages:
- `goto(path)`: Navigate to a path
- `waitForLoad()`: Wait for network idle
- `waitForLoadingComplete()`: Wait for spinners to disappear
- `safeClick(locator)`: Click with visibility check
- `fillInput(locator, value)`: Fill input with validation
- `assertTitleContains()`, `assertURLContains()`: Navigation assertions

### LoginPage (`pages/login.page.ts`)
Methods for authentication flows:
- `goto()`: Navigate to login
- `fillCredentials(email, password)`: Fill login form
- `login(email, password)`: Complete login flow
- `assertLoginSuccess()`, `assertLoginFailure()`: Assertion helpers

### BrowsePage (`pages/browse.page.ts`)
Methods for professional browsing:
- `search(keyword)`: Search professionals
- `selectCategory(category)`: Filter by category
- `getProfessionalCard(index)`: Access specific pro card
- `sortBy(option)`: Change result sorting
- `assertResultsCount(expected)`: Verify result count

### DashboardPage (`pages/dashboard.page.ts`)
Methods for authenticated user flows:
- `assertLoaded()`: Verify dashboard loaded
- `assertRedirected()`: Verify auth redirect
- `getWalletBalance()`: Read wallet value
- `logout()`: Sign out user

## 🎯 Writing New Tests

### Using Fixtures

```typescript
import { test, expect } from "../fixtures/test-fixtures";

test.describe("My Feature", () => {
  test("does something", async ({ page, loginPage, browsePage }) => {
    // Use page objects for clean, maintainable tests
    await loginPage.goto();
    await loginPage.login("user@test.com", "password");
    
    await browsePage.goto();
    await browsePage.search("plumber");
    
    await expect(browsePage.getProfessionalCard(0)).toBeVisible();
  });
});
```

### Using Authenticated Fixture

For tests that require a logged-in user:

```typescript
test("requires authentication", async ({ authenticatedPage, dashboardPage }) => {
  // User is automatically logged in
  await dashboardPage.goto();
  await dashboardPage.assertLoaded();
  
  // Your test logic here
});
```

### Best Practices

1. **Use page objects**: Never use raw selectors in tests
2. **Add meaningful assertions**: Verify both positive and negative cases
3. **Handle loading states**: Use `waitForLoadingComplete()` after actions
4. **Use data-testid attributes**: Add `data-testid` to key elements in your app
5. **Make tests independent**: Each test should set up its own state
6. **Skip when appropriate**: Use `test.skip()` for conditional tests
7. **Add descriptive test names**: Follow "should [action] when [condition]" pattern

## 🔧 CI/CD Integration

### GitHub Actions

The project includes GitHub Actions configuration. Tests run with:

- Single worker to avoid resource contention
- GitHub reporter for PR annotations
- HTML report artifact for detailed results

### Environment Variables for CI

```yaml
env:
  E2E_BASE_URL: "https://staging.proneighbor.app"
  TEST_RESIDENT_EMAIL: ${{ secrets.TEST_RESIDENT_EMAIL }}
  TEST_RESIDENT_PASSWORD: ${{ secrets.TEST_RESIDENT_PASSWORD }}
```

### Viewing Test Results

After running tests:

```bash
# Open HTML report
npx playwright show-report

# View trace for a failed test
npx playwright show-trace test-results/<test-name>/trace.zip
```

## 🐛 Debugging Tips

1. **Run in headed mode**: `npx playwright test --headed`
2. **Add pauses**: Use `await page.pause()` to inspect state
3. **Enable verbose logging**: `DEBUG=pw:api npx playwright test`
4. **Use trace viewer**: `npx playwright show-trace trace.zip`
5. **Take screenshots**: `await page.screenshot({ path: 'debug.png' })`
6. **Console logs**: `page.on('console', msg => console.log(msg.text()))`

## 📊 Test Coverage Goals

| Feature | Test Status | Priority |
|---------|------------|----------|
| User Authentication | ✅ Complete | Critical |
| Browse Professionals | ✅ Complete | Critical |
| Professional Booking | ✅ Complete | Critical |
| Wallet & Payments | 🔄 In Progress | High |
| Messaging System | ⏳ Planned | Medium |
| Admin Dashboard | ⏳ Planned | Medium |
| Mobile Responsiveness | 🔄 In Progress | High |

## 🔄 Updating Tests

When the application changes:

1. **Update page objects first**: Modify selectors in `pages/*.ts` files
2. **Run tests in UI mode**: `npm run test:e2e:ui` to visually verify
3. **Update snapshots if needed**: `npx playwright test --update-snapshots`
4. **Verify in CI**: Ensure tests pass in GitHub Actions

## 📞 Support

- Playwright Docs: https://playwright.dev/docs/intro
- Internal Testing Guide: See `AUTH_README.md` for auth setup
- Issues: Create a ticket with test name and error details
