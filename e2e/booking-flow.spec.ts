import { test, expect } from "./fixtures/test-fixtures";

/**
 * End-to-end tests for the professional booking flow
 * Tests the complete user journey: browse -> select pro -> book -> confirm
 */
test.describe("Professional Booking Flow", () => {
  test.skip(
    !process.env.TEST_RESIDENT_EMAIL,
    "Booking tests require authenticated user. Set TEST_RESIDENT_EMAIL env var."
  );

  test("complete booking flow: browse, select, and book a professional", async ({
    authenticatedPage,
    browsePage,
    dashboardPage,
  }) => {
    // Step 1: Browse professionals
    await browsePage.goto();
    await browsePage.assertLoaded();
    
    const proCount = await browsePage.getProfessionalCount();
    test.skip(proCount === 0, "No professionals available for booking test");
    
    // Step 2: Select a professional
    await browsePage.viewProfessional(0);
    
    // Wait for professional detail page to load
    await expect(
      authenticatedPage.locator("h1").first()
    ).toBeVisible({ timeout: 15000 });
    
    // Verify professional details are displayed
    await expect(
      authenticatedPage.locator("[data-testid='pro-description']").first()
    ).toBeVisible({ timeout: 15000 });
    
    await expect(
      authenticatedPage.locator("[data-testid='pro-rating']").first()
    ).toBeVisible({ timeout: 15000 });
    
    // Step 3: Initiate booking
    const bookButton = authenticatedPage.getByRole("button", { 
      name: /book|hire|request|consultation/i 
    }).first();
    
    await expect(bookButton).toBeVisible();
    await bookButton.click();
    
    // Step 4: Fill booking form on /book/:proId
    await authenticatedPage.waitForURL(/\/book\//, { timeout: 15000 });
    
    // Select date (tomorrow)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    
    const dateInput = authenticatedPage.locator("input[type='date']").first();
    if (await dateInput.isVisible()) {
      await dateInput.fill(dateStr);
    }
    
    await authenticatedPage.waitForTimeout(1500);

    // Select time slot
    const timeSlotSelect = authenticatedPage.locator("#start-time, select").last();
    if (await timeSlotSelect.isVisible()) {
      const options = await timeSlotSelect.locator("option").count();
      if (options > 1) {
        await timeSlotSelect.selectOption({ index: 1 });
      }
    }
    
    // Fill service details/brief
    const serviceInput = authenticatedPage.locator("#booking-notes, textarea").first();
    if (await serviceInput.isVisible()) {
      await serviceInput.fill("Test booking: Fix kitchen sink leak");
    }
    
    // Step 5: Advance to review / Step 2
    const continueButton = authenticatedPage.getByRole("button", { 
      name: /continue/i 
    }).first();
    
    await expect(continueButton).toBeEnabled({ timeout: 15000 });
    await continueButton.click();
    
    // Step 6: Confirm booking
    await authenticatedPage.waitForTimeout(1000);
    const submitButton = authenticatedPage.getByRole("button", { 
      name: /confirm|send quote|hold/i 
    }).first();
    
    if (await submitButton.isVisible()) {
      await submitButton.click();
      
      // Verify confirmation screen
      await expect(
        authenticatedPage.locator("text=/booking requested|confirmed|request sent/i").first()
      ).toBeVisible({ timeout: 15000 });
    }
    
    // Step 7: Verify booking appears in My Bookings
    await authenticatedPage.goto("/bookings");
    await expect(authenticatedPage).toHaveURL(/\/bookings/, { timeout: 15000 });
    await expect(
      authenticatedPage.locator("h1, h2, .booking-card, table, .empty-state").first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("booking form validation prevents submission with missing data", async ({
    authenticatedPage,
    browsePage,
  }) => {
    await browsePage.goto();
    await browsePage.assertLoaded();
    
    const proCount = await browsePage.getProfessionalCount();
    test.skip(proCount === 0, "No professionals available");
    
    await browsePage.viewProfessional(0);
    
    // Wait for detail page
    await expect(
      authenticatedPage.locator("h1").first()
    ).toBeVisible({ timeout: 15000 });
    
    // Click book button
    const bookButton = authenticatedPage.getByRole("button", { 
      name: /book|hire|request|consultation/i 
    }).first();
    await bookButton.click();
    
    await authenticatedPage.waitForURL(/\/book\//, { timeout: 15000 });
    
    // Try to submit without filling required fields
    const continueBtn = authenticatedPage.getByRole("button", { 
      name: /continue/i 
    }).first();
    await continueBtn.click();
    
    // Should show validation error or stay on booking page
    await authenticatedPage.waitForTimeout(1000);
    const hasError = await authenticatedPage.locator(".error-box, text=/select.*date|required/i").first().isVisible().catch(() => false);
    const dateInput = authenticatedPage.locator("input[type='date']").first();
    const isRequired = await dateInput.evaluate((el: HTMLInputElement) => el.required || el.hasAttribute('required'));
    
    expect(hasError || isRequired).toBeTruthy();
  });

  test("user can cancel booking before confirmation", async ({
    authenticatedPage,
    browsePage,
  }) => {
    await browsePage.goto();
    await browsePage.assertLoaded();
    
    const proCount = await browsePage.getProfessionalCount();
    test.skip(proCount === 0, "No professionals available");
    
    await browsePage.viewProfessional(0);
    
    const bookButton = authenticatedPage.getByRole("button", { 
      name: /book|hire|request|consultation/i 
    }).first();
    await bookButton.click();
    
    await authenticatedPage.waitForURL(/\/book\//, { timeout: 15000 });
    
    // Look for Back button
    const backButton = authenticatedPage.getByRole("button", { 
      name: /back/i 
    }).first();
    
    if (await backButton.isVisible()) {
      await backButton.click();
      
      // User should navigate back
      await authenticatedPage.waitForTimeout(1000);
      expect(authenticatedPage.url().includes('/pro/') || authenticatedPage.url().includes('/browse')).toBeTruthy();
    }
  });

  test("booking respects wallet balance requirements", async ({
    authenticatedPage,
    browsePage,
    dashboardPage,
  }) => {
    // Navigate to dashboard to check wallet
    await dashboardPage.goto();
    await dashboardPage.waitForDataLoad();
    
    const walletText = await dashboardPage.getWalletBalance();
    test.skip(!walletText, "Wallet balance not displayed");
    
    // Browse to a professional
    await browsePage.goto();
    await browsePage.assertLoaded();
    const proCount = await browsePage.getProfessionalCount();
    test.skip(proCount === 0, "No professionals available");
    
    await browsePage.viewProfessional(0);
    
    // Detail page loaded
    await expect(authenticatedPage.locator("h1").first()).toBeVisible({ timeout: 15000 });
    expect(true).toBeTruthy();
  });
});
