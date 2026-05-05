# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication Flow >> navigation from login to signup works
- Location: e2e\auth.spec.ts:75:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('link', { name: /sign up|register/i }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('link', { name: /sign up|register/i }).first()

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
    - button "Continue with Google" [ref=e16] [cursor=pointer]:
      - img [ref=e17]
      - text: Continue with Google
    - generic [ref=e22]: or sign in with email
    - generic [ref=e23]:
      - generic [ref=e24]:
        - generic [ref=e25]: Email
        - textbox "you@example.com" [ref=e26]
      - generic [ref=e27]:
        - generic [ref=e28]: Password
        - textbox "••••••••" [ref=e29]
      - button "Sign In" [ref=e30]
    - paragraph [ref=e31]:
      - link "Forgot password?" [ref=e32] [cursor=pointer]:
        - /url: /forgot-password
    - paragraph [ref=e33]:
      - text: Don't have an account?
      - link "Create one" [ref=e34] [cursor=pointer]:
        - /url: /register
    - paragraph [ref=e35]:
      - text: Need help?
      - link "Contact Support" [ref=e36] [cursor=pointer]:
        - /url: /contact
```

# Test source

```ts
  1  | import { test, expect } from "./fixtures/test-fixtures";
  2  | 
  3  | test.describe("Authentication Flow", () => {
  4  |   test("landing page loads and displays sign-in CTA", async ({ page, loginPage }) => {
  5  |     await page.goto("/");
  6  |     await loginPage.waitForLoad();
  7  |     
  8  |     await loginPage.assertTitleContains(/ProNeighbor|NeighbourPro/i);
  9  |     await expect(loginPage.signInButton).toBeVisible();
  10 |     await expect(loginPage.signUpButton).toBeVisible();
  11 |   });
  12 | 
  13 |   test("unauthenticated user is redirected from protected routes", async ({ page, dashboardPage }) => {
  14 |     await page.goto("/dashboard");
  15 |     await dashboardPage.waitForLoad();
  16 |     
  17 |     await dashboardPage.assertRedirected();
  18 |   });
  19 | 
  20 |   test("login page renders with required form fields", async ({ loginPage }) => {
  21 |     await loginPage.goto();
  22 |     await loginPage.assertFormVisible();
  23 |     
  24 |     await expect(loginPage.emailInput).toBeVisible();
  25 |     await expect(loginPage.passwordInput).toBeVisible();
  26 |     await expect(loginPage.signInButton).toBeVisible();
  27 |   });
  28 | 
  29 |   test("displays error message on invalid credentials", async ({ loginPage }) => {
  30 |     await loginPage.login("notreal@example.com", "wrongpassword");
  31 |     
  32 |     await loginPage.assertLoginFailure();
  33 |     const errorMessage = await loginPage.getErrorMessage();
  34 |     expect(errorMessage).toBeTruthy();
  35 |     expect(errorMessage).toMatch(/invalid|incorrect|error|failed/i);
  36 |   });
  37 | 
  38 |   test("successful login redirects to dashboard", async ({ 
  39 |     page, 
  40 |     loginPage, 
  41 |     dashboardPage 
  42 |   }, testInfo) => {
  43 |     // Skip if test credentials not configured
  44 |     test.skip(
  45 |       !process.env.TEST_RESIDENT_EMAIL, 
  46 |       "Test credentials not configured. Set TEST_RESIDENT_EMAIL and TEST_RESIDENT_PASSWORD env vars."
  47 |     );
  48 | 
  49 |     const email = process.env.TEST_RESIDENT_EMAIL!;
  50 |     const password = process.env.TEST_RESIDENT_PASSWORD!;
  51 |     
  52 |     await loginPage.login(email, password);
  53 |     await loginPage.assertLoginSuccess();
  54 |     
  55 |     await dashboardPage.waitForDataLoad();
  56 |     await dashboardPage.assertLoaded();
  57 |     
  58 |     // Verify user-specific content is visible
  59 |     await expect(dashboardPage.welcomeMessage).toBeVisible();
  60 |     await expect(dashboardPage.walletBalance).toBeVisible();
  61 |   });
  62 | 
  63 |   test("forgot password flow is accessible", async ({ loginPage }) => {
  64 |     await loginPage.goto();
  65 |     
  66 |     await expect(loginPage.forgotPasswordLink).toBeVisible();
  67 |     await loginPage.clickForgotPassword();
  68 |     
  69 |     // Should navigate to password reset page or show modal
  70 |     await expect(
  71 |       page.locator("text=/reset password|forgot password|enter your email/i").first()
  72 |     ).toBeVisible({ timeout: 5000 });
  73 |   });
  74 | 
  75 |   test("navigation from login to signup works", async ({ loginPage, page }) => {
  76 |     await loginPage.goto();
  77 |     
> 78 |     await expect(loginPage.signUpLink).toBeVisible();
     |                                        ^ Error: expect(locator).toBeVisible() failed
  79 |     await loginPage.clickSignUp();
  80 |     
  81 |     // Should navigate to signup page
  82 |     await expect(page).toHaveURL(/signup|register|auth\/sign-up/);
  83 |   });
  84 | });
  85 | 
```