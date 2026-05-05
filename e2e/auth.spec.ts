import { test, expect } from "./fixtures/test-fixtures";

test.describe("Authentication Flow", () => {
  test("landing page loads and displays sign-in CTA", async ({ page, loginPage }) => {
    await page.goto("/");
    await loginPage.waitForLoad();
    
    await loginPage.assertTitleContains(/ProNeighbor|NeighbourPro/i);
    await expect(loginPage.signInButton).toBeVisible();
    await expect(loginPage.signUpButton).toBeVisible();
  });

  test("unauthenticated user is redirected from protected routes", async ({ page, dashboardPage }) => {
    await page.goto("/dashboard");
    await dashboardPage.waitForLoad();
    
    await dashboardPage.assertRedirected();
  });

  test("login page renders with required form fields", async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.assertFormVisible();
    
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.signInButton).toBeVisible();
  });

  test("displays error message on invalid credentials", async ({ loginPage }) => {
    await loginPage.login("notreal@example.com", "wrongpassword");
    
    await loginPage.assertLoginFailure();
    const errorMessage = await loginPage.getErrorMessage();
    expect(errorMessage).toBeTruthy();
    expect(errorMessage).toMatch(/invalid|incorrect|error|failed/i);
  });

  test("successful login redirects to dashboard", async ({ 
    page, 
    loginPage, 
    dashboardPage 
  }, testInfo) => {
    // Skip if test credentials not configured
    test.skip(
      !process.env.TEST_RESIDENT_EMAIL, 
      "Test credentials not configured. Set TEST_RESIDENT_EMAIL and TEST_RESIDENT_PASSWORD env vars."
    );

    const email = process.env.TEST_RESIDENT_EMAIL!;
    const password = process.env.TEST_RESIDENT_PASSWORD!;
    
    await loginPage.login(email, password);
    await loginPage.assertLoginSuccess();
    
    await dashboardPage.waitForDataLoad();
    await dashboardPage.assertLoaded();
    
    // Verify user-specific content is visible
    await expect(dashboardPage.welcomeMessage).toBeVisible();
    await expect(dashboardPage.walletBalance).toBeVisible();
  });

  test("forgot password flow is accessible", async ({ loginPage, page }) => {
    await loginPage.goto();
    
    await expect(loginPage.forgotPasswordLink).toBeVisible();
    await loginPage.clickForgotPassword();
    
    // Should navigate to password reset page or show modal
    await expect(
      page.locator("text=/reset password|forgot password|enter your email/i").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("navigation from login to signup works", async ({ loginPage, page }) => {
    await loginPage.goto();
    
    await expect(loginPage.signUpLink).toBeVisible();
    await loginPage.clickSignUp();
    
    // Should navigate to signup page
    await expect(page).toHaveURL(/signup|register|auth\/sign-up/);
  });
});
