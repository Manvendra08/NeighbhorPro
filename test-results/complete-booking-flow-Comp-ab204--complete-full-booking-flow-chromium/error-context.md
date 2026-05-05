# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: complete-booking-flow.spec.ts >> Complete Booking Flow >> should complete full booking flow
- Location: e2e\complete-booking-flow.spec.ts:63:3

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - link "Logo ProNeighbor" [ref=e5] [cursor=pointer]:
      - /url: /
      - img "Logo" [ref=e6]
      - text: ProNeighbor
    - heading "Your community, your experts." [level=2] [ref=e7]
    - paragraph [ref=e8]: Connect with verified local professionals — CA, Tutor, Health experts, and more — within your neighborhood.
    - generic [ref=e9]: ● Launch in May 2026 for Park Street Residents
  - generic [ref=e11]:
    - link "Logo" [ref=e12] [cursor=pointer]:
      - /url: /
      - img "Logo" [ref=e13]
    - heading "Welcome back" [level=1] [ref=e14]
    - paragraph [ref=e15]: Sign in to your ProNeighbor account
    - generic [ref=e16]: Sign-in failed. Check your credentials.
    - button "Continue with Google" [ref=e17] [cursor=pointer]:
      - img [ref=e18]
      - text: Continue with Google
    - generic [ref=e23]: or sign in with email
    - generic [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e26]: Email
        - textbox "you@example.com" [ref=e27]: test@proneighbor.test
      - generic [ref=e28]:
        - generic [ref=e29]: Password
        - textbox "••••••••" [ref=e30]: TestPassword123!
      - button "Sign In" [ref=e31]
    - paragraph [ref=e32]:
      - link "Forgot password?" [ref=e33] [cursor=pointer]:
        - /url: /forgot-password
    - paragraph [ref=e34]:
      - text: Don't have an account?
      - link "Create one" [ref=e35] [cursor=pointer]:
        - /url: /register
    - paragraph [ref=e36]:
      - text: Need help?
      - link "Contact Support" [ref=e37] [cursor=pointer]:
        - /url: /contact
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * ProNeighbor Complete Booking Flow E2E Tests
  5   |  * Tests the entire booking workflow from login to confirmation
  6   |  */
  7   | 
  8   | test.describe('Complete Booking Flow', () => {
  9   |   const testEmail = 'test@proneighbor.test';
  10  |   const testPassword = 'TestPassword123!';
  11  | 
  12  |   // Helper function to login
  13  |   async function login(page) {
  14  |     await page.goto('/login');
  15  |     await page.locator('input[type="email"]').fill(testEmail);
  16  |     await page.locator('input[type="password"]').fill(testPassword);
  17  |     await page.locator('button[type="submit"]').click();
> 18  |     await page.waitForURL(/\/dashboard/, { timeout: 10000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  19  |   }
  20  | 
  21  |   test.beforeEach(async ({ page }) => {
  22  |     // Login before each test
  23  |     await login(page);
  24  |   });
  25  | 
  26  |   test('should display browse services page', async ({ page }) => {
  27  |     // Navigate to browse page
  28  |     await page.goto('/browse');
  29  | 
  30  |     // Check page loaded
  31  |     await expect(page).toHaveURL(/\/browse/);
  32  | 
  33  |     // Check for services or empty state
  34  |     const servicesExist = await page.locator('[data-testid="service-card"], .service-card, .card').count() > 0;
  35  |     const emptyState = await page.locator('text=/no.*service|empty/i').isVisible().catch(() => false);
  36  | 
  37  |     expect(servicesExist || emptyState).toBeTruthy();
  38  |   });
  39  | 
  40  |   test('should view service details', async ({ page }) => {
  41  |     await page.goto('/browse');
  42  | 
  43  |     // Wait for services to load
  44  |     await page.waitForTimeout(2000);
  45  | 
  46  |     // Find first service card
  47  |     const firstService = page.locator('[data-testid="service-card"], .service-card, .card').first();
  48  | 
  49  |     if (await firstService.isVisible()) {
  50  |       // Click on first service
  51  |       await firstService.click();
  52  | 
  53  |       // Wait for navigation to service detail page
  54  |       await page.waitForURL(/\/pro\/|\/service\//, { timeout: 10000 });
  55  | 
  56  |       // Verify service detail page elements
  57  |       await expect(
  58  |         page.locator('text=/book|consultation|details/i')
  59  |       ).toBeVisible({ timeout: 5000 });
  60  |     }
  61  |   });
  62  | 
  63  |   test('should complete full booking flow', async ({ page }) => {
  64  |     await page.goto('/browse');
  65  | 
  66  |     // Wait for services to load
  67  |     await page.waitForTimeout(2000);
  68  | 
  69  |     // Find and click first service
  70  |     const firstService = page.locator('[data-testid="service-card"], .service-card, .card').first();
  71  | 
  72  |     if (await firstService.isVisible()) {
  73  |       await firstService.click();
  74  | 
  75  |       // Wait for service detail page
  76  |       await page.waitForURL(/\/pro\/|\/service\//, { timeout: 10000 });
  77  | 
  78  |       // Click Book Now button
  79  |       const bookButton = page.locator('button:has-text("Book"), button:has-text("Consultation")');
  80  |       await bookButton.click();
  81  | 
  82  |       // Wait for booking form
  83  |       await page.waitForURL(/\/book\//, { timeout: 10000 });
  84  | 
  85  |       // Fill in booking form
  86  |       // Select date (tomorrow)
  87  |       const tomorrow = new Date();
  88  |       tomorrow.setDate(tomorrow.getDate() + 1);
  89  |       const tomorrowStr = tomorrow.toISOString().split('T')[0];
  90  | 
  91  |       const dateInput = page.locator('input[type="date"]');
  92  |       if (await dateInput.isVisible()) {
  93  |         await dateInput.fill(tomorrowStr);
  94  |       }
  95  | 
  96  |       // Wait for time slots to load
  97  |       await page.waitForTimeout(2000);
  98  | 
  99  |       // Select first available time slot
  100 |       const timeSlotSelect = page.locator('select[id*="time"], select:has-text("Select")');
  101 |       if (await timeSlotSelect.isVisible()) {
  102 |         const options = await timeSlotSelect.locator('option').count();
  103 |         if (options > 1) {
  104 |           await timeSlotSelect.selectOption({ index: 1 });
  105 |         }
  106 |       }
  107 | 
  108 |       // Fill in brief/notes
  109 |       const notesTextarea = page.locator('textarea[id*="notes"], textarea[id*="brief"]');
  110 |       if (await notesTextarea.isVisible()) {
  111 |         await notesTextarea.fill('Test booking for E2E automation');
  112 |       }
  113 | 
  114 |       // Click Continue button
  115 |       const continueButton = page.locator('button:has-text("Continue")');
  116 |       await continueButton.click();
  117 | 
  118 |       // Wait for confirmation page
```