# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: signup-flow.spec.ts >> Signup Flow >> should show error for invalid email format
- Location: e2e\signup-flow.spec.ts:40:3

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('button[type="submit"]')
    - locator resolved to <button disabled type="submit" class="btn-3d">Create Account</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    18 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - link "Logo ProNeighbor" [ref=e5] [cursor=pointer]:
      - /url: /
      - img "Logo" [ref=e6]
      - text: ProNeighbor
    - heading "Find trusted pros, near you." [level=2] [ref=e7]
    - paragraph [ref=e8]: Connect with verified local professionals — CA, Tutor, Health experts, and more — within your neighborhood.
    - generic [ref=e9]: ● Launch in May 2026 for Park Street Residents
  - generic [ref=e11]:
    - link "Logo" [ref=e12] [cursor=pointer]:
      - /url: /
      - img "Logo" [ref=e13]
    - heading "Create account" [level=1] [ref=e14]
    - paragraph [ref=e15]: Join your neighborhood network
    - button "Continue with Google" [ref=e16] [cursor=pointer]:
      - img [ref=e17]
      - text: Continue with Google
    - generic [ref=e22]: or register with email
    - generic [ref=e23]:
      - generic [ref=e24]:
        - generic [ref=e25]: Full Name
        - textbox "John Doe" [ref=e26]
      - generic [ref=e27]:
        - generic [ref=e28]: Email
        - textbox "you@example.com" [ref=e29]: invalid-email
      - generic [ref=e30]:
        - generic [ref=e31]: Password
        - textbox "Min 8 characters" [ref=e32]: TestPassword123!
      - generic [ref=e33]:
        - generic [ref=e34]: Confirm Password
        - textbox "••••••••" [active] [ref=e35]: TestPassword123!
      - generic [ref=e36]:
        - generic [ref=e37]: Referral Code (optional)
        - textbox "PNXXXXXX" [ref=e38]
      - generic [ref=e39]:
        - checkbox "I have read and agree to the Terms of Service and Privacy Policy." [ref=e40]
        - generic [ref=e41] [cursor=pointer]:
          - text: I have read and agree to the
          - link "Terms of Service" [ref=e42]:
            - /url: /terms
          - text: and
          - link "Privacy Policy" [ref=e43]:
            - /url: /privacy
          - text: .
      - button "Create Account" [disabled] [ref=e44]
    - paragraph [ref=e45]:
      - text: Already have an account?
      - link "Sign in" [ref=e46] [cursor=pointer]:
        - /url: /login
    - paragraph [ref=e47]:
      - text: Need help?
      - link "Contact Support" [ref=e48] [cursor=pointer]:
        - /url: /contact
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * ProNeighbor Signup Flow E2E Tests
  5   |  * Tests user registration and account creation
  6   |  */
  7   | 
  8   | test.describe('Signup Flow', () => {
  9   |   const timestamp = Date.now();
  10  |   const testEmail = `testuser_${timestamp}@proneighbor.test`;
  11  |   const testPassword = 'TestPassword123!';
  12  | 
  13  |   test.beforeEach(async ({ page }) => {
  14  |     // Navigate to registration page
  15  |     await page.goto('/register');
  16  |   });
  17  | 
  18  |   test('should display registration page correctly', async ({ page }) => {
  19  |     // Check page title
  20  |     await expect(page).toHaveTitle(/ProNeighbor/);
  21  | 
  22  |     // Check registration form elements
  23  |     await expect(page.locator('input[type="email"]')).toBeVisible();
  24  |     await expect(page.locator('input[type="password"]')).toBeVisible();
  25  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  26  | 
  27  |     // Check for logo
  28  |     await expect(page.locator('img[alt*="Logo"]')).toBeVisible();
  29  |   });
  30  | 
  31  |   test('should show validation errors for empty form', async ({ page }) => {
  32  |     // Click submit without filling form
  33  |     await page.locator('button[type="submit"]').click();
  34  | 
  35  |     // Check for validation messages (HTML5 validation or custom)
  36  |     const emailInput = page.locator('input[type="email"]');
  37  |     await expect(emailInput).toHaveAttribute('required', '');
  38  |   });
  39  | 
  40  |   test('should show error for invalid email format', async ({ page }) => {
  41  |     // Fill in invalid email
  42  |     await page.locator('input[type="email"]').fill('invalid-email');
  43  |     await page.locator('input[type="password"]').first().fill(testPassword);
  44  |     await page.locator('input[type="password"]').last().fill(testPassword);
  45  | 
  46  |     // Submit form
> 47  |     await page.locator('button[type="submit"]').click();
      |                                                 ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  48  | 
  49  |     // Check for error (HTML5 validation will prevent submission)
  50  |     const emailInput = page.locator('input[type="email"]');
  51  |     const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
  52  |     expect(validationMessage).toBeTruthy();
  53  |   });
  54  | 
  55  |   test('should show error for password mismatch', async ({ page }) => {
  56  |     // Fill in form with mismatched passwords
  57  |     await page.locator('input[type="email"]').fill(testEmail);
  58  |     
  59  |     const passwordInputs = page.locator('input[type="password"]');
  60  |     await passwordInputs.first().fill(testPassword);
  61  |     await passwordInputs.last().fill('DifferentPassword123!');
  62  | 
  63  |     // Submit form
  64  |     await page.locator('button[type="submit"]').click();
  65  | 
  66  |     // Check for error message
  67  |     await expect(page.locator('text=/password.*match/i')).toBeVisible({ timeout: 5000 });
  68  |   });
  69  | 
  70  |   test('should successfully register a new user', async ({ page }) => {
  71  |     // Fill in registration form
  72  |     await page.locator('input[type="email"]').fill(testEmail);
  73  |     
  74  |     const passwordInputs = page.locator('input[type="password"]');
  75  |     await passwordInputs.first().fill(testPassword);
  76  |     await passwordInputs.last().fill(testPassword);
  77  | 
  78  |     // Check terms checkbox if present
  79  |     const termsCheckbox = page.locator('input[type="checkbox"]');
  80  |     if (await termsCheckbox.isVisible()) {
  81  |       await termsCheckbox.check();
  82  |     }
  83  | 
  84  |     // Submit form
  85  |     await page.locator('button[type="submit"]').click();
  86  | 
  87  |     // Wait for navigation or success message
  88  |     await page.waitForURL(/\/(email-verified|dashboard|login)/, { timeout: 10000 });
  89  | 
  90  |     // Verify we're on a success page
  91  |     const currentUrl = page.url();
  92  |     expect(
  93  |       currentUrl.includes('email-verified') ||
  94  |       currentUrl.includes('dashboard') ||
  95  |       currentUrl.includes('login')
  96  |     ).toBeTruthy();
  97  |   });
  98  | 
  99  |   test('should show error for already registered email', async ({ page }) => {
  100 |     // Use a known existing email
  101 |     const existingEmail = 'test@proneighbor.test';
  102 | 
  103 |     // Fill in form
  104 |     await page.locator('input[type="email"]').fill(existingEmail);
  105 |     
  106 |     const passwordInputs = page.locator('input[type="password"]');
  107 |     await passwordInputs.first().fill(testPassword);
  108 |     await passwordInputs.last().fill(testPassword);
  109 | 
  110 |     // Submit form
  111 |     await page.locator('button[type="submit"]').click();
  112 | 
  113 |     // Check for error message
  114 |     await expect(
  115 |       page.locator('text=/already.*exist|email.*taken|already.*registered/i')
  116 |     ).toBeVisible({ timeout: 10000 });
  117 |   });
  118 | 
  119 |   test('should have working Google sign-in button', async ({ page }) => {
  120 |     // Check if Google sign-in button exists
  121 |     const googleButton = page.locator('button:has-text("Google")');
  122 |     
  123 |     if (await googleButton.isVisible()) {
  124 |       await expect(googleButton).toBeEnabled();
  125 |       
  126 |       // Note: We don't actually click it to avoid OAuth flow
  127 |       // Just verify it's present and clickable
  128 |     }
  129 |   });
  130 | 
  131 |   test('should navigate to login page from signup', async ({ page }) => {
  132 |     // Find and click login link
  133 |     const loginLink = page.locator('a[href*="/login"], a:has-text("Sign In"), a:has-text("Login")');
  134 |     await loginLink.click();
  135 | 
  136 |     // Verify navigation to login page
  137 |     await expect(page).toHaveURL(/\/login/);
  138 |   });
  139 | 
  140 |   test('should have accessible form elements', async ({ page }) => {
  141 |     // Check for proper labels
  142 |     const emailInput = page.locator('input[type="email"]');
  143 |     const emailLabel = page.locator('label:has-text("Email")');
  144 |     
  145 |     await expect(emailLabel).toBeVisible();
  146 |     await expect(emailInput).toBeVisible();
  147 | 
```