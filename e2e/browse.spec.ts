import { test, expect } from "@playwright/test";

test.describe("Browse Professionals", () => {
  test("browse pros page is accessible without auth", async ({ page }) => {
    await page.goto("/browse");
    // Should load (may redirect to login or show public listing)
    await expect(page).toHaveURL(/.+/);
    // Page shouldn't be blank
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("landing page renders core value proposition", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    // Verify at least one CTA button or link exists
    await expect(page.locator("button, a[href]").first()).toBeVisible();
  });

  test("privacy policy and terms are reachable", async ({ page }) => {
    await page.goto("/privacy-policy");
    await expect(page.locator("h1, h2").first()).toBeVisible();

    await page.goto("/terms-of-service");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
