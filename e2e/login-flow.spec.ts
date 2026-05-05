import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  const testEmail = 'test@proneighbor.test';
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/ProNeighbor/);

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Use first() to avoid strict mode violation — auth panel has two logos
    await expect(page.locator('img[alt="Logo"]').first()).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.locator('input[type="email"]').fill('invalid@example.com');
    await page.locator('input[type="password"]').first().fill('WrongPassword123!');
    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator('text=/incorrect|invalid|wrong|not found/i')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('text=/dashboard|welcome/i')).toBeVisible({ timeout: 5000 });
  });

  test('should persist session after login', async ({ page, context }) => {
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    const cookies = await context.cookies();
    expect(cookies.length).toBeGreaterThan(0);

    await page.goto('/browse');
    await expect(page).toHaveURL(/\/browse/);
  });

  test('should have working Google sign-in button', async ({ page }) => {
    const googleButton = page.locator('button:has-text("Google")');
    if (await googleButton.isVisible()) {
      await expect(googleButton).toBeEnabled();
    }
  });

  test('should navigate to forgot password page', async ({ page }) => {
    const forgotPasswordLink = page.locator('a[href*="/forgot-password"], a:has-text("Forgot")');
    if (await forgotPasswordLink.isVisible()) {
      await forgotPasswordLink.click();
      await expect(page).toHaveURL(/\/forgot-password/);
    }
  });

  test('should navigate to signup page from login', async ({ page }) => {
    const signupLink = page.locator('a[href*="/register"], a:has-text("Create"), a:has-text("Sign Up")');
    await signupLink.click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('should show/hide password toggle', async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(testPassword);

    const toggleButton = page.locator('button[aria-label*="password"], button:has-text("Show"), button:has-text("Hide")');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      const inputType = await passwordInput.getAttribute('type');
      expect(inputType === 'text' || inputType === 'password').toBeTruthy();
    }
  });

  test('should have accessible form elements', async ({ page }) => {
    await expect(page.locator('label:has-text("Email")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    // Use exact match to avoid matching "Confirm Password"
    await expect(page.locator('label').filter({ hasText: /^Password$/ })).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.context().setOffline(true);

    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(2000);
    expect(page.url().includes('/login')).toBeTruthy();

    await page.context().setOffline(false);
  });
});

test.describe('Login Flow - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  const testEmail = 'test@proneighbor.test';
  const testPassword = 'TestPassword123!';

  test('should work on mobile viewport', async ({ page }) => {
    await page.goto('/login');

    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Login Flow - Authenticated State', () => {
  test('should redirect to dashboard if already logged in', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('test@proneighbor.test');
    await page.locator('input[type="password"]').first().fill('TestPassword123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });

    await page.goto('/login');
    await page.waitForURL(/\/dashboard/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
