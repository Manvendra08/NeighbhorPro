import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Dashboard Page Object Model
 */
export class DashboardPage extends BasePage {
  readonly welcomeMessage: Locator;
  readonly bookingsSection: Locator;
  readonly messagesSection: Locator;
  readonly walletBalance: Locator;
  readonly newBookingButton: Locator;
  readonly profileLink: Locator;
  readonly logoutButton: Locator;
  readonly sidebar: Locator;

  constructor(page: Page) {
    super(page);
    
    this.welcomeMessage = page.locator("h1, .welcome-message").filter({ hasText: /welcome|hello/i }).first();
    this.bookingsSection = page.locator("[data-testid='bookings'], .bookings-section, #bookings");
    this.messagesSection = page.locator("[data-testid='messages'], .messages-section, #messages");
    this.walletBalance = page.locator("[data-testid='wallet-balance'], .wallet-balance, #wallet, [href='/wallet'], [ref*='wallet'], link:has-text('🪙'), .wallet-info, [data-testid*='coin'], [data-testid*='balance']").first();
    this.newBookingButton = page.getByRole("button", { name: /new booking|book now|hire pro/i }).first();
    this.profileLink = page.getByRole("link", { name: /my profile|profile|account/i }).first();
    this.logoutButton = page.getByRole("button", { name: /log out|sign out/i }).first();
    this.sidebar = page.locator("aside, [role='complementary'], .sidebar");
  }

  /**
   * Navigate to dashboard (requires auth)
   */
  async goto(): Promise<void> {
    await super.goto("/dashboard");
    await this.waitForLoad();
  }

  /**
   * Assert user is on dashboard
   */
  async assertLoaded(): Promise<void> {
    await expect(this.welcomeMessage).toBeVisible();
    await expect(this.page).toHaveURL(/dashboard/);
  }

  /**
   * Assert unauthenticated user is redirected
   */
  async assertRedirected(): Promise<void> {
    await expect(this.page).not.toHaveURL(/dashboard/);
    await expect(this.page).toHaveURL(/login|auth|\/$/);
  }

  /**
   * Click new booking button
   */
  async createNewBooking(): Promise<void> {
    await this.safeClick(this.newBookingButton);
  }

  /**
   * Navigate to profile
   */
  async goToProfile(): Promise<void> {
    await this.safeClick(this.profileLink);
  }

  /**
   * Log out from dashboard
   */
  async logout(): Promise<void> {
    await this.safeClick(this.logoutButton);
    await this.waitForLoad();
  }

  /**
   * Get wallet balance text
   */
  async getWalletBalance(): Promise<string | null> {
    if (await this.walletBalance.isVisible()) {
      return await this.walletBalance.textContent();
    }
    return null;
  }

  /**
   * Assert booking section has expected count
   */
  async assertBookingCount(expected: number): Promise<void> {
    const bookings = this.bookingsSection.locator("[data-testid='booking-item'], .booking-card");
    await expect(bookings).toHaveCount(expected);
  }

  /**
   * Wait for dashboard data to load
   */
  async waitForDataLoad(timeout = 15000): Promise<void> {
    await this.loadingSpinner.first().waitFor({ state: 'detached', timeout });
    await this.page.waitForTimeout(500); // Extra buffer for React hydration
  }
}
