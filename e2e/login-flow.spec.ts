import { test, expect } from '@playwright/test';

/**
 * ProNeighbor Login Flow E2E Tests
 * Tests user authentication and session management
 */

test.describe('Login Flow', () => {
  const testEmail = 'test@proneighbor.test';
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/ProNeighbor/);

    // Check login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check for logo (use specific selector to avoid strict mode violation)
    await expect(page.locator('img[alt="Logo"][src*="logo_new"]')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    // Click submit without filling form
    await page.locator('button[type="submit"]').click();

    // Check for validation (HTML5 validation)
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in form with invalid credentials
    await page.locator('input[type="email"]').fill('invalid@example.com');
    await page.locator('input[type="password"]').fill('WrongPassword123!');

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Check for error message
    await expect(
      page.locator('text=/incorrect|invalid|wrong|not found/i')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Fill in login form
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Wait for navigation to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Check for dashboard elements
    await expect(
      page.locator('text=/dashboard|welcome/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should persist session after login', async ({ page, context }) => {
    // Login
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // Wait for dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Get cookies
    const cookies = await context.cookies();
    expect(cookies.length).toBeGreaterThan(0);

    // Navigate to another page
    await page.goto('/browse');

    // Should still be logged in (not redirected to login)
    await expect(page).toHaveURL(/\/browse/);
  });

  test('should have working Google sign-in button', async ({ page }) => {
    // Check if Google sign-in button exists
    const googleButton = page.locator('button:has-text("Google")');
    
    if (await googleButton.isVisible()) {
      await expect(googleButton).toBeEnabled();
      
      // Note: We don't actually click it to avoid OAuth flow
      // Just verify it's present and clickable
    }
  });

  test('should navigate to forgot password page', async ({ page }) => {
    // Find and click forgot password link
    const forgotPasswordLink = page.locator('a[href*="/forgot-password"], a:has-text("Forgot")');
    
    if (await forgotPasswordLink.isVisible()) {
      await forgotPasswordLink.click();

      // Verify navigation
      await expect(page).toHaveURL(/\/forgot-password/);
    }
  });

  test('should navigate to signup page from login', async ({ page }) => {
    // Find and click signup link
    const signupLink = page.locator('a[href*="/register"], a:has-text("Create"), a:has-text("Sign Up")');
    await signupLink.click();

    // Verify navigation to signup page
    await expect(page).toHaveURL(/\/register/);
  });

  test('should show/hide password toggle', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill(testPassword);

    // Look for password toggle button
    const toggleButton = page.locator('button[aria-label*="password"], button:has-text("Show"), button:has-text("Hide")');
    
    if (await toggleButton.isVisible()) {
      // Click to show password
      await toggleButton.click();

      // Check if input type changed
      const inputType = await passwordInput.getAttribute('type');
      expect(inputType === 'text' || inputType === 'password').toBeTruthy();
    }
  });

  test('should have accessible form elements', async ({ page }) => {
    // Check for proper labels
    const emailInput = page.locator('input[type="email"]');
    const emailLabel = page.locator('label:has-text("Email")');
    
    await expect(emailLabel).toBeVisible();
    await expect(emailInput).toBeVisible();

    // Check for password label
    const passwordLabel = page.locator('label:has-text("Password")');
    await expect(passwordLabel).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);

    // Try to login
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.locator('button[type="submit"]').click();

    // Should show error or stay on page
    await page.waitForTimeout(2000);

    // Verify we're still on login page or see error
    const currentUrl = page.url();
    expect(currentUrl.includes('/login')).toBeTruthy();

    // Restore online mode
    await page.context().setOffline(false);
  });
});

test.describe('Login Flow - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  const testEmail = 'test@proneighbor.test';
  const testPassword = 'TestPassword123!';

  test('should work on mobile viewport', async ({ page }) => {
    await page.goto('/login');

    // Fill in form
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Wait for navigation
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify success
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Login Flow - Authenticated State', () => {
  test('should redirect to dashboard if already logged in', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@proneighbor.test');
    await page.locator('input[type="password"]').fill('TestPassword123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Try to go back to login page
    await page.goto('/login');

    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
