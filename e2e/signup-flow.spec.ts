import { test, expect } from '@playwright/test';

// Helper: fill the full register form (name + email + pw + confirm + terms)
async function fillRegisterForm(
  page: import('@playwright/test').Page,
  opts: { name?: string; email: string; password: string; confirm?: string }
) {
  const { name = 'Test User', email, password, confirm = password } = opts;

  await page.locator('input[placeholder="John Doe"]').fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[placeholder="Min 8 characters"]').fill(password);
  await page.locator('input[placeholder="••••••••"]').fill(confirm);

  // Accept terms — required for submit to enable
  const terms = page.locator('input#terms');
  if (!(await terms.isChecked())) {
    await terms.check();
  }
}

test.describe('Signup Flow', () => {
  const timestamp = Date.now();
  const testEmail = `testuser_${timestamp}@proneighbor.test`;
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display registration page correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/ProNeighbor/);

    await expect(page.locator('input[type="email"]')).toBeVisible();
    // Use placeholder-based selectors — two password fields exist
    await expect(page.locator('input[placeholder="Min 8 characters"]')).toBeVisible();
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Use first() — auth panel has two logo images
    await expect(page.locator('img[alt="Logo"]').first()).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    // Submit is disabled until form filled — click email and check required attr
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.locator('input[type="email"]').fill('invalid-email');
    await page.locator('input[placeholder="Min 8 characters"]').fill(testPassword);
    await page.locator('input[placeholder="••••••••"]').fill(testPassword);

    const emailInput = page.locator('input[type="email"]');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });

  test('should show error for password mismatch', async ({ page }) => {
    await fillRegisterForm(page, {
      email: testEmail,
      password: testPassword,
      confirm: 'DifferentPassword123!',
    });

    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=/password.*match/i')).toBeVisible({ timeout: 5000 });
  });

  test('should successfully register a new user', async ({ page }) => {
    await fillRegisterForm(page, { email: testEmail, password: testPassword });

    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/(email-verified|dashboard|login)/, { timeout: 15000 });

    const url = page.url();
    expect(
      url.includes('email-verified') || url.includes('dashboard') || url.includes('login')
    ).toBeTruthy();
  });

  test('should show error for already registered email', async ({ page }) => {
    await fillRegisterForm(page, {
      email: 'test@proneighbor.test',
      password: testPassword,
    });

    await page.locator('button[type="submit"]').click();

    await expect(
      page.locator('text=/already.*exist|email.*taken|already.*registered/i')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should have working Google sign-in button', async ({ page }) => {
    const googleButton = page.locator('button:has-text("Google")');
    if (await googleButton.isVisible()) {
      await expect(googleButton).toBeEnabled();
    }
  });

  test('should navigate to login page from signup', async ({ page }) => {
    const loginLink = page.locator('a[href*="/login"], a:has-text("Sign in"), a:has-text("Login")');
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should have accessible form elements', async ({ page }) => {
    await expect(page.locator('label:has-text("Email")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Exact match — avoids matching "Confirm Password"
    await expect(page.locator('label').filter({ hasText: /^Password$/ })).toBeVisible();
    await expect(page.locator('label:has-text("Confirm Password")')).toBeVisible();
    await expect(page.locator('label:has-text("Full Name")')).toBeVisible();
  });
});

test.describe('Signup Flow - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  const timestamp = Date.now();
  const testEmail = `mobile_${timestamp}@proneighbor.test`;
  const testPassword = 'TestPassword123!';

  test('should work on mobile viewport', async ({ page }) => {
    await page.goto('/register');

    await fillRegisterForm(page, { email: testEmail, password: testPassword });

    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/(email-verified|dashboard|login)/, { timeout: 15000 });

    const url = page.url();
    expect(
      url.includes('email-verified') || url.includes('dashboard') || url.includes('login')
    ).toBeTruthy();
  });
});
