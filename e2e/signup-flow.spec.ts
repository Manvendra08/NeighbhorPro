import { test, expect } from '@playwright/test';

/**
 * ProNeighbor Signup Flow E2E Tests
 * Tests user registration and account creation
 */

test.describe('Signup Flow', () => {
  const timestamp = Date.now();
  const testEmail = `testuser_${timestamp}@proneighbor.test`;
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');
  });

  test('should display registration page correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/ProNeighbor/);

    // Check registration form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Check for logo
    await expect(page.locator('img[alt*="Logo"]')).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    // Click submit without filling form
    await page.locator('button[type="submit"]').click();

    // Check for validation messages (HTML5 validation or custom)
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('should show error for invalid email format', async ({ page }) => {
    // Fill in invalid email
    await page.locator('input[type="email"]').fill('invalid-email');
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('input[type="password"]').last().fill(testPassword);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Check for error (HTML5 validation will prevent submission)
    const emailInput = page.locator('input[type="email"]');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });

  test('should show error for password mismatch', async ({ page }) => {
    // Fill in form with mismatched passwords
    await page.locator('input[type="email"]').fill(testEmail);
    
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(testPassword);
    await passwordInputs.last().fill('DifferentPassword123!');

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Check for error message
    await expect(page.locator('text=/password.*match/i')).toBeVisible({ timeout: 5000 });
  });

  test('should successfully register a new user', async ({ page }) => {
    // Fill in registration form
    await page.locator('input[type="email"]').fill(testEmail);
    
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(testPassword);
    await passwordInputs.last().fill(testPassword);

    // Check terms checkbox if present
    const termsCheckbox = page.locator('input[type="checkbox"]');
    if (await termsCheckbox.isVisible()) {
      await termsCheckbox.check();
    }

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Wait for navigation or success message
    await page.waitForURL(/\/(email-verified|dashboard|login)/, { timeout: 10000 });

    // Verify we're on a success page
    const currentUrl = page.url();
    expect(
      currentUrl.includes('email-verified') ||
      currentUrl.includes('dashboard') ||
      currentUrl.includes('login')
    ).toBeTruthy();
  });

  test('should show error for already registered email', async ({ page }) => {
    // Use a known existing email
    const existingEmail = 'test@proneighbor.test';

    // Fill in form
    await page.locator('input[type="email"]').fill(existingEmail);
    
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(testPassword);
    await passwordInputs.last().fill(testPassword);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Check for error message
    await expect(
      page.locator('text=/already.*exist|email.*taken|already.*registered/i')
    ).toBeVisible({ timeout: 10000 });
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

  test('should navigate to login page from signup', async ({ page }) => {
    // Find and click login link
    const loginLink = page.locator('a[href*="/login"], a:has-text("Sign In"), a:has-text("Login")');
    await loginLink.click();

    // Verify navigation to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should have accessible form elements', async ({ page }) => {
    // Check for proper labels
    const emailInput = page.locator('input[type="email"]');
    const emailLabel = page.locator('label:has-text("Email")');
    
    await expect(emailLabel).toBeVisible();
    await expect(emailInput).toBeVisible();

    // Check for password labels
    const passwordLabel = page.locator('label:has-text("Password")');
    await expect(passwordLabel).toBeVisible();
  });
});

test.describe('Signup Flow - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  const timestamp = Date.now();
  const testEmail = `mobile_${timestamp}@proneighbor.test`;
  const testPassword = 'TestPassword123!';

  test('should work on mobile viewport', async ({ page }) => {
    await page.goto('/register');

    // Fill in form
    await page.locator('input[type="email"]').fill(testEmail);
    
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.first().fill(testPassword);
    await passwordInputs.last().fill(testPassword);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Wait for navigation
    await page.waitForURL(/\/(email-verified|dashboard|login)/, { timeout: 10000 });

    // Verify success
    const currentUrl = page.url();
    expect(
      currentUrl.includes('email-verified') ||
      currentUrl.includes('dashboard') ||
      currentUrl.includes('login')
    ).toBeTruthy();
  });
});
