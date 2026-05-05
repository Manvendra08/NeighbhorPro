# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login-flow.spec.ts >> Login Flow >> should persist session after login
- Location: e2e\login-flow.spec.ts:73:3

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
  4   |  * ProNeighbor Login Flow E2E Tests
  5   |  * Tests user authentication and session management
  6   |  */
  7   | 
  8   | test.describe('Login Flow', () => {
  9   |   const testEmail = 'test@proneighbor.test';
  10  |   const testPassword = 'TestPassword123!';
  11  | 
  12  |   test.beforeEach(async ({ page }) => {
  13  |     // Navigate to login page
  14  |     await page.goto('/login');
  15  |   });
  16  | 
  17  |   test('should display login page correctly', async ({ page }) => {
  18  |     // Check page title
  19  |     await expect(page).toHaveTitle(/ProNeighbor/);
  20  | 
  21  |     // Check login form elements
  22  |     await expect(page.locator('input[type="email"]')).toBeVisible();
  23  |     await expect(page.locator('input[type="password"]')).toBeVisible();
  24  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  25  | 
  26  |     // Check for logo
  27  |     await expect(page.locator('img[alt*="Logo"]')).toBeVisible();
  28  |   });
  29  | 
  30  |   test('should show validation errors for empty form', async ({ page }) => {
  31  |     // Click submit without filling form
  32  |     await page.locator('button[type="submit"]').click();
  33  | 
  34  |     // Check for validation (HTML5 validation)
  35  |     const emailInput = page.locator('input[type="email"]');
  36  |     await expect(emailInput).toHaveAttribute('required', '');
  37  |   });
  38  | 
  39  |   test('should show error for invalid credentials', async ({ page }) => {
  40  |     // Fill in form with invalid credentials
  41  |     await page.locator('input[type="email"]').fill('invalid@example.com');
  42  |     await page.locator('input[type="password"]').fill('WrongPassword123!');
  43  | 
  44  |     // Submit form
  45  |     await page.locator('button[type="submit"]').click();
  46  | 
  47  |     // Check for error message
  48  |     await expect(
  49  |       page.locator('text=/incorrect|invalid|wrong|not found/i')
  50  |     ).toBeVisible({ timeout: 10000 });
  51  |   });
  52  | 
  53  |   test('should successfully login with valid credentials', async ({ page }) => {
  54  |     // Fill in login form
  55  |     await page.locator('input[type="email"]').fill(testEmail);
  56  |     await page.locator('input[type="password"]').fill(testPassword);
  57  | 
  58  |     // Submit form
  59  |     await page.locator('button[type="submit"]').click();
  60  | 
  61  |     // Wait for navigation to dashboard
  62  |     await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  63  | 
  64  |     // Verify we're on dashboard
  65  |     await expect(page).toHaveURL(/\/dashboard/);
  66  | 
  67  |     // Check for dashboard elements
  68  |     await expect(
  69  |       page.locator('text=/dashboard|welcome/i')
  70  |     ).toBeVisible({ timeout: 5000 });
  71  |   });
  72  | 
  73  |   test('should persist session after login', async ({ page, context }) => {
  74  |     // Login
  75  |     await page.locator('input[type="email"]').fill(testEmail);
  76  |     await page.locator('input[type="password"]').fill(testPassword);
  77  |     await page.locator('button[type="submit"]').click();
  78  | 
  79  |     // Wait for dashboard
> 80  |     await page.waitForURL(/\/dashboard/, { timeout: 10000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  81  | 
  82  |     // Get cookies
  83  |     const cookies = await context.cookies();
  84  |     expect(cookies.length).toBeGreaterThan(0);
  85  | 
  86  |     // Navigate to another page
  87  |     await page.goto('/browse');
  88  | 
  89  |     // Should still be logged in (not redirected to login)
  90  |     await expect(page).toHaveURL(/\/browse/);
  91  |   });
  92  | 
  93  |   test('should have working Google sign-in button', async ({ page }) => {
  94  |     // Check if Google sign-in button exists
  95  |     const googleButton = page.locator('button:has-text("Google")');
  96  |     
  97  |     if (await googleButton.isVisible()) {
  98  |       await expect(googleButton).toBeEnabled();
  99  |       
  100 |       // Note: We don't actually click it to avoid OAuth flow
  101 |       // Just verify it's present and clickable
  102 |     }
  103 |   });
  104 | 
  105 |   test('should navigate to forgot password page', async ({ page }) => {
  106 |     // Find and click forgot password link
  107 |     const forgotPasswordLink = page.locator('a[href*="/forgot-password"], a:has-text("Forgot")');
  108 |     
  109 |     if (await forgotPasswordLink.isVisible()) {
  110 |       await forgotPasswordLink.click();
  111 | 
  112 |       // Verify navigation
  113 |       await expect(page).toHaveURL(/\/forgot-password/);
  114 |     }
  115 |   });
  116 | 
  117 |   test('should navigate to signup page from login', async ({ page }) => {
  118 |     // Find and click signup link
  119 |     const signupLink = page.locator('a[href*="/register"], a:has-text("Create"), a:has-text("Sign Up")');
  120 |     await signupLink.click();
  121 | 
  122 |     // Verify navigation to signup page
  123 |     await expect(page).toHaveURL(/\/register/);
  124 |   });
  125 | 
  126 |   test('should show/hide password toggle', async ({ page }) => {
  127 |     const passwordInput = page.locator('input[type="password"]');
  128 |     await passwordInput.fill(testPassword);
  129 | 
  130 |     // Look for password toggle button
  131 |     const toggleButton = page.locator('button[aria-label*="password"], button:has-text("Show"), button:has-text("Hide")');
  132 |     
  133 |     if (await toggleButton.isVisible()) {
  134 |       // Click to show password
  135 |       await toggleButton.click();
  136 | 
  137 |       // Check if input type changed
  138 |       const inputType = await passwordInput.getAttribute('type');
  139 |       expect(inputType === 'text' || inputType === 'password').toBeTruthy();
  140 |     }
  141 |   });
  142 | 
  143 |   test('should have accessible form elements', async ({ page }) => {
  144 |     // Check for proper labels
  145 |     const emailInput = page.locator('input[type="email"]');
  146 |     const emailLabel = page.locator('label:has-text("Email")');
  147 |     
  148 |     await expect(emailLabel).toBeVisible();
  149 |     await expect(emailInput).toBeVisible();
  150 | 
  151 |     // Check for password label
  152 |     const passwordLabel = page.locator('label:has-text("Password")');
  153 |     await expect(passwordLabel).toBeVisible();
  154 |   });
  155 | 
  156 |   test('should handle network errors gracefully', async ({ page }) => {
  157 |     // Simulate offline mode
  158 |     await page.context().setOffline(true);
  159 | 
  160 |     // Try to login
  161 |     await page.locator('input[type="email"]').fill(testEmail);
  162 |     await page.locator('input[type="password"]').fill(testPassword);
  163 |     await page.locator('button[type="submit"]').click();
  164 | 
  165 |     // Should show error or stay on page
  166 |     await page.waitForTimeout(2000);
  167 | 
  168 |     // Verify we're still on login page or see error
  169 |     const currentUrl = page.url();
  170 |     expect(currentUrl.includes('/login')).toBeTruthy();
  171 | 
  172 |     // Restore online mode
  173 |     await page.context().setOffline(false);
  174 |   });
  175 | });
  176 | 
  177 | test.describe('Login Flow - Mobile', () => {
  178 |   test.use({ viewport: { width: 375, height: 667 } });
  179 | 
  180 |   const testEmail = 'test@proneighbor.test';
```