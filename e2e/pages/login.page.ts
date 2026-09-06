import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Login Page Object Model
 */
export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;
  readonly rememberMeCheckbox: Locator;

  constructor(page: Page) {
    super(page);
    
    this.emailInput = page.locator("input[type='email'], input[name='email'], #email").first();
    this.passwordInput = page.locator("input[type='password'], input[name='password'], #password").first();
    this.signInButton = page.getByRole("button", { name: /sign in|log in/i }).first();
    this.forgotPasswordLink = page.getByRole("link", { name: /forgot password/i }).first();
    this.signUpLink = page.getByRole("link", { name: /sign up|register/i }).first();
    this.rememberMeCheckbox = page.locator("input[type='checkbox'], #remember-me").first();
  }

  /**
   * Navigate to login page
   */
  async goto(): Promise<void> {
    await super.goto("/login");
    await this.waitForLoad();
  }

  /**
   * Fill login form with credentials
   */
  async fillCredentials(email: string, password: string): Promise<void> {
    await this.fillInput(this.emailInput, email);
    await this.fillInput(this.passwordInput, password);
  }

  /**
   * Submit the login form
   */
  async submit(): Promise<void> {
    await this.safeClick(this.signInButton);
  }

  /**
   * Complete login flow with credentials
   */
  async login(email: string, password: string): Promise<void> {
    await this.goto();
    await this.fillCredentials(email, password);
    await this.submit();
    await this.waitForLoadingComplete();
  }

  /**
   * Assert login form is visible
   */
  async assertFormVisible(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.signInButton).toBeVisible();
  }

  /**
   * Assert successful login (redirected to dashboard)
   */
  async assertLoginSuccess(): Promise<void> {
    await this.page.waitForURL(/\/dashboard|\/home|\/browse/, { timeout: 15000 });
    await expect(this.page).not.toHaveURL(/login|auth/);
    await expect(this.page).toHaveURL(/dashboard|home|browse/);
  }

  /**
   * Assert login failure with error message
   */
  async assertLoginFailure(expectedError?: string): Promise<void> {
    await expect(this.errorBox.first()).toBeVisible();
    if (expectedError) {
      await expect(this.errorBox.first()).toContainText(expectedError);
    }
  }

  /**
   * Click forgot password link
   */
  async clickForgotPassword(): Promise<void> {
    await this.safeClick(this.forgotPasswordLink);
  }

  /**
   * Click sign up link
   */
  async clickSignUp(): Promise<void> {
    await this.safeClick(this.signUpLink);
  }
}
