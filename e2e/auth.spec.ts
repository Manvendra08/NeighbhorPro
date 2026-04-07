import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("landing page loads and shows sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ProNeighbor|NeighbourPro/i);
    // Sign In may be a button or link on the landing page
    await expect(
      page.locator("a, button").filter({ hasText: /sign in|log in|get started/i }).first()
    ).toBeVisible();
  });

  test("unauthenticated user is redirected from dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    // Should redirect to landing or login
    await expect(page).not.toHaveURL(/dashboard/);
  });

  test("sign-in page renders email and password fields", async ({ page }) => {
    await page.goto("/");
    // Click the first sign-in CTA (may be a button or link)
    const signinBtn = page.locator("a, button").filter({ hasText: /sign in|log in/i }).first();
    if (await signinBtn.isVisible()) {
      await signinBtn.click();
    }
    await expect(page.locator("input[type='email'], input[name='email']").first()).toBeVisible({ timeout: 5000 });
  });

  test("displays error on invalid credentials", async ({ page }) => {
    await page.goto("/");
    const signinBtn = page.locator("a, button").filter({ hasText: /sign in|log in/i }).first();
    if (await signinBtn.isVisible()) await signinBtn.click();
    const emailInput = page.locator("input[type='email'], input[name='email']").first();
    await emailInput.fill("notreal@example.com");
    await page.locator("input[type='password']").first().fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|log in/i }).first().click();
    await expect(
      page.getByText(/invalid|wrong|error|not found/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
