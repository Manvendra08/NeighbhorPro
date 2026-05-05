# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login-flow.spec.ts >> Login Flow - Mobile >> should work on mobile viewport
- Location: e2e\login-flow.spec.ts:183:3

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
  - text: ●
  - generic [ref=e5]:
    - link "Logo" [ref=e6] [cursor=pointer]:
      - /url: /
      - img "Logo" [ref=e7]
    - heading "Welcome back" [level=1] [ref=e8]
    - paragraph [ref=e9]: Sign in to your ProNeighbor account
    - generic [ref=e10]: Sign-in failed. Check your credentials.
    - button "Continue with Google" [ref=e11] [cursor=pointer]:
      - img [ref=e12]
      - text: Continue with Google
    - generic [ref=e17]: or sign in with email
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]: Email
        - textbox "you@example.com" [ref=e21]: test@proneighbor.test
      - generic [ref=e22]:
        - generic [ref=e23]: Password
        - textbox "••••••••" [ref=e24]: TestPassword123!
      - button "Sign In" [ref=e25]
    - paragraph [ref=e26]:
      - link "Forgot password?" [ref=e27] [cursor=pointer]:
        - /url: /forgot-password
    - paragraph [ref=e28]:
      - text: Don't have an account?
      - link "Create one" [ref=e29] [cursor=pointer]:
        - /url: /register
    - paragraph [ref=e30]:
      - text: Need help?
      - link "Contact Support" [ref=e31] [cursor=pointer]:
        - /url: /contact
```

# Test source

```ts
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
  181 |   const testPassword = 'TestPassword123!';
  182 | 
  183 |   test('should work on mobile viewport', async ({ page }) => {
  184 |     await page.goto('/login');
  185 | 
  186 |     // Fill in form
  187 |     await page.locator('input[type="email"]').fill(testEmail);
  188 |     await page.locator('input[type="password"]').fill(testPassword);
  189 | 
  190 |     // Submit form
  191 |     await page.locator('button[type="submit"]').click();
  192 | 
  193 |     // Wait for navigation
> 194 |     await page.waitForURL(/\/dashboard/, { timeout: 10000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  195 | 
  196 |     // Verify success
  197 |     await expect(page).toHaveURL(/\/dashboard/);
  198 |   });
  199 | });
  200 | 
  201 | test.describe('Login Flow - Authenticated State', () => {
  202 |   test('should redirect to dashboard if already logged in', async ({ page }) => {
  203 |     // First login
  204 |     await page.goto('/login');
  205 |     await page.locator('input[type="email"]').fill('test@proneighbor.test');
  206 |     await page.locator('input[type="password"]').fill('TestPassword123!');
  207 |     await page.locator('button[type="submit"]').click();
  208 |     await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  209 | 
  210 |     // Try to go back to login page
  211 |     await page.goto('/login');
  212 | 
  213 |     // Should redirect to dashboard
  214 |     await page.waitForURL(/\/dashboard/, { timeout: 5000 });
  215 |     await expect(page).toHaveURL(/\/dashboard/);
  216 |   });
  217 | });
  218 | 
```