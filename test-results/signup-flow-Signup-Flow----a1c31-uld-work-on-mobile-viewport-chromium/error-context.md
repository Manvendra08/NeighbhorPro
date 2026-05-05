# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: signup-flow.spec.ts >> Signup Flow - Mobile >> should work on mobile viewport
- Location: e2e\signup-flow.spec.ts:161:3

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
    17 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - text: ●
  - generic [ref=e5]:
    - link "Logo" [ref=e6] [cursor=pointer]:
      - /url: /
      - img "Logo" [ref=e7]
    - heading "Create account" [level=1] [ref=e8]
    - paragraph [ref=e9]: Join your neighborhood network
    - button "Continue with Google" [ref=e10] [cursor=pointer]:
      - img [ref=e11]
      - text: Continue with Google
    - generic [ref=e16]: or register with email
    - generic [ref=e17]:
      - generic [ref=e18]:
        - generic [ref=e19]: Full Name
        - textbox "John Doe" [ref=e20]
      - generic [ref=e21]:
        - generic [ref=e22]: Email
        - textbox "you@example.com" [ref=e23]: mobile_1777973669418@proneighbor.test
      - generic [ref=e24]:
        - generic [ref=e25]: Password
        - textbox "Min 8 characters" [ref=e26]: TestPassword123!
      - generic [ref=e27]:
        - generic [ref=e28]: Confirm Password
        - textbox "••••••••" [active] [ref=e29]: TestPassword123!
      - generic [ref=e30]:
        - generic [ref=e31]: Referral Code (optional)
        - textbox "PNXXXXXX" [ref=e32]
      - generic [ref=e33]:
        - checkbox "I have read and agree to the Terms of Service and Privacy Policy." [ref=e34]
        - generic [ref=e35] [cursor=pointer]:
          - text: I have read and agree to the
          - link "Terms of Service" [ref=e36]:
            - /url: /terms
          - text: and
          - link "Privacy Policy" [ref=e37]:
            - /url: /privacy
          - text: .
      - button "Create Account" [disabled] [ref=e38]
    - paragraph [ref=e39]:
      - text: Already have an account?
      - link "Sign in" [ref=e40] [cursor=pointer]:
        - /url: /login
    - paragraph [ref=e41]:
      - text: Need help?
      - link "Contact Support" [ref=e42] [cursor=pointer]:
        - /url: /contact
```

# Test source

```ts
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
  148 |     // Check for password labels
  149 |     const passwordLabel = page.locator('label:has-text("Password")');
  150 |     await expect(passwordLabel).toBeVisible();
  151 |   });
  152 | });
  153 | 
  154 | test.describe('Signup Flow - Mobile', () => {
  155 |   test.use({ viewport: { width: 375, height: 667 } });
  156 | 
  157 |   const timestamp = Date.now();
  158 |   const testEmail = `mobile_${timestamp}@proneighbor.test`;
  159 |   const testPassword = 'TestPassword123!';
  160 | 
  161 |   test('should work on mobile viewport', async ({ page }) => {
  162 |     await page.goto('/register');
  163 | 
  164 |     // Fill in form
  165 |     await page.locator('input[type="email"]').fill(testEmail);
  166 |     
  167 |     const passwordInputs = page.locator('input[type="password"]');
  168 |     await passwordInputs.first().fill(testPassword);
  169 |     await passwordInputs.last().fill(testPassword);
  170 | 
  171 |     // Submit form
> 172 |     await page.locator('button[type="submit"]').click();
      |                                                 ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  173 | 
  174 |     // Wait for navigation
  175 |     await page.waitForURL(/\/(email-verified|dashboard|login)/, { timeout: 10000 });
  176 | 
  177 |     // Verify success
  178 |     const currentUrl = page.url();
  179 |     expect(
  180 |       currentUrl.includes('email-verified') ||
  181 |       currentUrl.includes('dashboard') ||
  182 |       currentUrl.includes('login')
  183 |     ).toBeTruthy();
  184 |   });
  185 | });
  186 | 
```