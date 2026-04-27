import { test as base, Page } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import { BrowsePage } from "../pages/browse.page";
import { DashboardPage } from "../pages/dashboard.page";

/**
 * Test fixtures for ProNeighbor E2E tests
 * Extends Playwright's base test with custom fixtures
 */

export type TestFixtures = {
  loginPage: LoginPage;
  browsePage: BrowsePage;
  dashboardPage: DashboardPage;
  authenticatedPage: Page;
};

export const test = base.extend<TestFixtures>({
  // Create page objects for each test
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  
  browsePage: async ({ page }, use) => {
    await use(new BrowsePage(page));
  },
  
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  
  // Authenticated page fixture - automatically logs in before test
  authenticatedPage: async ({ page, loginPage }, use) => {
    const email = process.env.TEST_RESIDENT_EMAIL || "resident@test.proneighbor.app";
    const password = process.env.TEST_RESIDENT_PASSWORD || "Test@123456";
    
    // Login before test
    await loginPage.login(email, password);
    await loginPage.assertLoginSuccess();
    
    await use(page);
    
    // Optional: Logout after test for clean state
    // await dashboardPage.logout();
  },
});

export { expect } from "@playwright/test";
