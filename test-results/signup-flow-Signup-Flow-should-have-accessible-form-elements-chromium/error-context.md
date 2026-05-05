# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: signup-flow.spec.ts >> Signup Flow >> should have accessible form elements
- Location: e2e\signup-flow.spec.ts:140:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('label:has-text("Password")')
Expected: visible
Error: strict mode violation: locator('label:has-text("Password")') resolved to 2 elements:
    1) <label>Password</label> aka getByText('Password', { exact: true })
    2) <label>Confirm Password</label> aka getByText('Confirm Password')

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('label:has-text("Password")')

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
        - textbox "you@example.com" [ref=e29]
      - generic [ref=e30]:
        - generic [ref=e31]: Password
        - textbox "Min 8 characters" [ref=e32]
      - generic [ref=e33]:
        - generic [ref=e34]: Confirm Password
        - textbox "••••••••" [ref=e35]
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
  148 |     // Check for password labels
  149 |     const passwordLabel = page.locator('label:has-text("Password")');
> 150 |     await expect(passwordLabel).toBeVisible();
      |                                 ^ Error: expect(locator).toBeVisible() failed
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
  172 |     await page.locator('button[type="submit"]').click();
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