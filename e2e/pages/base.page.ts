import { Page, Locator, expect } from "@playwright/test";

/**
 * Base Page Object Model
 * Contains common selectors and methods used across all pages
 */
export class BasePage {
  readonly page: Page;
  
  // Common selectors
  readonly signInButton: Locator;
  readonly signUpButton: Locator;
  readonly navigationMenu: Locator;
  readonly footer: Locator;
  readonly errorBox: Locator;
  readonly successToast: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Global selectors
    this.signInButton = page.locator('a, button').filter({ hasText: /sign in|log in/i }).first();
    this.signUpButton = page.locator('a, button').filter({ hasText: /sign up|register|get started/i }).first();
    this.navigationMenu = page.locator('nav, [role="navigation"]');
    this.footer = page.locator('footer');
    this.errorBox = page.locator('.error-box, [role="alert"].error, .alert-error');
    this.successToast = page.locator('.toast-success, [role="status"].success, .alert-success');
    this.loadingSpinner = page.locator('.loading-spinner, .spinner, [aria-busy="true"]');
  }

  /**
   * Navigate to a relative path
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Wait for loading spinner to disappear
   */
  async waitForLoadingComplete(timeout = 10000): Promise<void> {
    await this.loadingSpinner.first().waitFor({ state: 'detached', timeout });
  }

  /**
   * Check if an error is displayed
   */
  async isErrorVisible(): Promise<boolean> {
    return await this.errorBox.first().isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.isErrorVisible()) {
      return await this.errorBox.first().textContent();
    }
    return null;
  }

  /**
   * Take a screenshot with label
   */
  async takeScreenshot(label: string): Promise<void> {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${label}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  /**
   * Assert page title contains expected text
   */
  async assertTitleContains(expected: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(expected);
  }

  /**
   * Assert URL contains expected pattern
   */
  async assertURLContains(expected: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(expected);
  }

  /**
   * Click with safety check
   */
  async safeClick(locator: Locator, timeout = 5000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
    await locator.click();
  }

  /**
   * Fill input with validation
   */
  async fillInput(locator: Locator, value: string, timeout = 5000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
    await locator.fill(value);
  }
}
