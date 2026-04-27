import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Browse Professionals Page Object Model
 */
export class BrowsePage extends BasePage {
  readonly searchInput: Locator;
  readonly categoryFilters: Locator;
  readonly professionalCards: Locator;
  readonly sortByDropdown: Locator;
  readonly locationFilter: Locator;
  readonly applyFiltersButton: Locator;
  readonly clearFiltersButton: Locator;

  constructor(page: Page) {
    super(page);
    
    this.searchInput = page.locator("input[placeholder*='search'], input[placeholder*='Search'], input[name='search'], #search").first();
    this.categoryFilters = page.locator("select, [data-testid='category-filter'], .category-filter, [role='tablist']").first();
    this.professionalCards = page.locator("[data-testid='pro-card'], .professional-card, .pro-listing, .pro-card, .m-pro-card");
    this.sortByDropdown = page.locator("select[name='sort'], [data-testid='sort-dropdown']").first();
    this.locationFilter = page.locator("input[placeholder*='location'], [data-testid='location-filter']").first();
    this.applyFiltersButton = page.getByRole("button", { name: /apply filters/i }).first();
    this.clearFiltersButton = page.getByRole("button", { name: /clear filters|reset/i }).first();
  }

  /**
   * Navigate to browse page
   */
  async goto(): Promise<void> {
    await super.goto("/browse");
    await this.waitForLoad();
  }

  /**
   * Search for professionals by keyword
   */
  async search(keyword: string): Promise<void> {
    await this.fillInput(this.searchInput, keyword);
    await this.page.waitForTimeout(500); // Allow search debounce
  }

  /**
   * Select a category filter
   */
  async selectCategory(category: string): Promise<void> {
    const categoryBtn = this.categoryFilters.locator(`button, [role="tab"]`).filter({ hasText: category });
    await this.safeClick(categoryBtn);
  }

  /**
   * Get visible professional cards count
   */
  async getProfessionalCount(): Promise<number> {
    return await this.professionalCards.count();
  }

  /**
   * Get professional card by index
   */
  getProfessionalCard(index: number): Locator {
    return this.professionalCards.nth(index);
  }

  /**
   * Click on a professional card to view details
   */
  async viewProfessional(index: number): Promise<void> {
    const card = this.getProfessionalCard(index);
    await this.safeClick(card);
  }

  /**
   * Sort results by option
   */
  async sortBy(option: string): Promise<void> {
    await this.sortByDropdown.selectOption(option);
    await this.waitForLoadingComplete();
  }

  /**
   * Apply location filter
   */
  async filterByLocation(location: string): Promise<void> {
    await this.fillInput(this.locationFilter, location);
    await this.safeClick(this.applyFiltersButton);
    await this.waitForLoadingComplete();
  }

  /**
   * Clear all applied filters
   */
  async clearFilters(): Promise<void> {
    await this.safeClick(this.clearFiltersButton);
    await this.waitForLoadingComplete();
  }

  /**
   * Assert browse page is loaded with professionals
   */
  async assertLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/browse/);
    await expect(this.searchInput).toBeVisible({ timeout: 15000 });
    // Wait for at least one professional card or "no results" message
    await expect(
      this.page.locator("[data-testid='pro-card'], .pro-card, .m-pro-card, .no-results, .empty-state").first()
    ).toBeVisible({ timeout: 10000 });
  }

  /**
   * Assert search results match expected count
   */
  async assertResultsCount(expected: number): Promise<void> {
    const count = await this.getProfessionalCount();
    expect(count).toBe(expected);
  }

  /**
   * Assert professional card has expected content
   */
  async assertProfessionalCardHas(index: number, expectedText: string | RegExp): Promise<void> {
    const card = this.getProfessionalCard(index);
    await expect(card).toContainText(expectedText);
  }
}
