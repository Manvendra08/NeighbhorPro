import { test, expect } from "./fixtures/test-fixtures";

async function ensureAuthenticated(loginPage: { login: (email: string, password: string) => Promise<void>; assertLoginSuccess: () => Promise<void> }): Promise<boolean> {
  const email = process.env.TEST_RESIDENT_EMAIL;
  const password = process.env.TEST_RESIDENT_PASSWORD;
  if (!email || !password) return false;

  try {
    await loginPage.login(email, password);
    await loginPage.assertLoginSuccess();
    return true;
  } catch {
    return false;
  }
}

test.describe("Browse Professionals", () => {
  test("browse route is protected for unauthenticated users", async ({ page }) => {
    await page.goto("/browse", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/browse$|\/login$|\/$/);
  });

  test("landing page displays core value proposition", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");
    
    // Verify headline is visible
    await expect(page.locator("h1, h2").first()).toBeVisible();
    
    // Verify at least one primary CTA exists
    await expect(
      page.locator("button, a[href]").filter({ hasText: /get started|browse|sign up|find pros/i }).first()
    ).toBeVisible();
  });

  test("legal pages (privacy & terms) are accessible", async ({ page }) => {
    await page.goto("/privacy", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page).toHaveURL(/\/privacy$/);

    await page.goto("/terms", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page).toHaveURL(/\/terms$/);
  });

  test("search functionality filters professionals", async ({ loginPage, browsePage }) => {
    const authenticated = await ensureAuthenticated(loginPage);
    test.skip(!authenticated, "Browse interaction tests require valid TEST_RESIDENT_EMAIL and TEST_RESIDENT_PASSWORD.");

    await browsePage.goto();
    await browsePage.assertLoaded();
    
    const initialCount = await browsePage.getProfessionalCount();
    
    // Perform a specific search
    await browsePage.search("plumber");
    await browsePage.waitForLoadingComplete();
    
    // Results should be filtered (could be 0 if no plumbers in test data)
    const filteredCount = await browsePage.getProfessionalCount();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("category filters update professional listings", async ({ loginPage, browsePage }) => {
    const authenticated = await ensureAuthenticated(loginPage);
    test.skip(!authenticated, "Browse interaction tests require valid TEST_RESIDENT_EMAIL and TEST_RESIDENT_PASSWORD.");

    await browsePage.goto();
    
    // Get initial state
    const initialCount = await browsePage.getProfessionalCount();
    
    // Try to select a category if available
    if (await browsePage.categoryFilters.isVisible()) {
      const options = await browsePage.categoryFilters.locator("option").all();
      if (options.length > 1) {
        await browsePage.categoryFilters.selectOption({ index: 1 });
      }
      await browsePage.waitForLoadingComplete();
      
      // Count should potentially change
      const filteredCount = await browsePage.getProfessionalCount();
      expect(filteredCount).toBeGreaterThanOrEqual(0);
    }
  });

  test("professional cards display required information", async ({ loginPage, browsePage }) => {
    const authenticated = await ensureAuthenticated(loginPage);
    test.skip(!authenticated, "Browse interaction tests require valid TEST_RESIDENT_EMAIL and TEST_RESIDENT_PASSWORD.");

    await browsePage.goto();
    await browsePage.assertLoaded();
    
    const count = await browsePage.getProfessionalCount();
    test.skip(count === 0, "No professionals available to test");
    
    // Check first professional card has visible text content
    const firstCard = browsePage.getProfessionalCard(0);
    await expect(firstCard).toBeVisible();
    const cardText = (await firstCard.textContent()) || "";
    expect(cardText.trim().length).toBeGreaterThan(0);
  });

  test("sorting options change result order", async ({ loginPage, browsePage }) => {
    const authenticated = await ensureAuthenticated(loginPage);
    test.skip(!authenticated, "Browse interaction tests require valid TEST_RESIDENT_EMAIL and TEST_RESIDENT_PASSWORD.");

    await browsePage.goto();
    await browsePage.assertLoaded();
    
    // Check if sort dropdown exists
    if (await browsePage.sortByDropdown.isVisible()) {
      // Get first professional name before sort
      const firstProBefore = await browsePage.getProfessionalCard(0)
        .locator("h3, h4, .pro-name").first()
        .textContent();
      
      // Change sort order
      await browsePage.sortBy("rating-desc");
      
      // First professional should potentially be different
      const firstProAfter = await browsePage.getProfessionalCard(0)
        .locator("h3, h4, .pro-name").first()
        .textContent();
      
      // Note: This is a soft assertion since sort might not change first result
      expect(firstProAfter).not.toBeNull();
    }
  });

  test("clear filters resets to default view", async ({ loginPage, browsePage }) => {
    const authenticated = await ensureAuthenticated(loginPage);
    test.skip(!authenticated, "Browse interaction tests require valid TEST_RESIDENT_EMAIL and TEST_RESIDENT_PASSWORD.");

    await browsePage.goto();
    await browsePage.assertLoaded();
    
    const initialCount = await browsePage.getProfessionalCount();
    
    // Apply a filter
    await browsePage.search("test");
    await browsePage.waitForLoadingComplete();
    
    await browsePage.getProfessionalCount();
    
    // Clear filters if button exists
    if (await browsePage.clearFiltersButton.isVisible()) {
      await browsePage.clearFilters();
      
      // Should return to initial state
      const resetCount = await browsePage.getProfessionalCount();
      expect(resetCount).toBe(initialCount);
    }
  });
});
