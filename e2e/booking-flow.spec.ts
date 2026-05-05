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
      name: /book now|hire|request service|schedule/i 
    }).first();
    
    await expect(bookButton).toBeVisible();
    await bookButton.click();
    
    // Step 4: Fill booking form
    const bookingModal = authenticatedPage.locator("[role='dialog']").first();
    await expect(bookingModal).toBeVisible({ timeout: 15000 });
    
    // Fill service details
    const serviceInput = authenticatedPage.locator("textarea[name='description']").first();
    if (await serviceInput.isVisible()) {
      await serviceInput.fill("Test booking: Fix kitchen sink leak");
    }
    
    // Select date/time if available
    const dateInput = authenticatedPage.locator("input[type='date']").first();
    if (await dateInput.isVisible()) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      await dateInput.fill(dateStr);
    }
    
    // Step 5: Submit booking
    const submitButton = authenticatedPage.getByRole("button", { 
      name: /confirm booking|submit request|book now/i 
    }).first();
    
    await expect(submitButton).toBeEnabled({ timeout: 15000 });
    await submitButton.click();
    
    // Step 6: Verify booking confirmation
    await expect(
      authenticatedPage.locator(".success-toast").first()
    ).toBeVisible({ timeout: 15000 });
    
    // Or check for confirmation page/message
    await expect(
      authenticatedPage.locator("text=/booking confirmed|request sent|thank you/i").first()
    ).toBeVisible({ timeout: 15000 });
    
    // Step 7: Verify booking appears in dashboard
    await dashboardPage.goto();
    await dashboardPage.waitForDataLoad();
    
    await expect(dashboardPage.bookingsSection).toBeVisible();
    
    // Check for the new booking in the list
    await expect(
      dashboardPage.bookingsSection.locator("text=/kitchen sink|test booking/i").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("booking form validation prevents submission with missing data", async ({
    authenticatedPage,
    browsePage,
  }) => {
    await browsePage.goto();
    
    const proCount = await browsePage.getProfessionalCount();
    test.skip(proCount === 0, "No professionals available");
    
    await browsePage.viewProfessional(0);
    
    // Wait for detail page
    await expect(
      authenticatedPage.locator("h1").first()
    ).toBeVisible({ timeout: 15000 });
    
    // Click book button
    const bookButton = authenticatedPage.getByRole("button", { 
      name: /book now|hire|request/i 
    }).first();
    await bookButton.click();
    
    // Try to submit without filling required fields
    const submitButton = authenticatedPage.getByRole("button", { 
      name: /confirm|submit|book/i 
    }).first();
    
    // If form has validation, submit should either be disabled or show errors
    if (await submitButton.isDisabled()) {
      // Expected: button disabled until form is valid
      expect(true).toBe(true);
    } else {
      // Try submitting empty form
      await submitButton.click();
      
      // Should show validation errors
      await expect(
        authenticatedPage.locator(".error").first()
      ).toBeVisible({ timeout: 15000 });
    }
  });

  test("user can cancel booking before confirmation", async ({
    authenticatedPage,
    browsePage,
  }) => {
    await browsePage.goto();
    
    const proCount = await browsePage.getProfessionalCount();
    test.skip(proCount === 0, "No professionals available");
    
    await browsePage.viewProfessional(0);
    
    const bookButton = authenticatedPage.getByRole("button", { 
      name: /book now|hire/i 
    }).first();
    await bookButton.click();
    
    // Look for cancel/close button in modal
    const cancelButton = authenticatedPage.getByRole("button", { 
      name: /cancel|close|back/i 
    }).first();
    
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      
      // Modal should close, user should be back on pro detail page
      await expect(
        authenticatedPage.locator("[role='dialog']").first()
      ).not.toBeVisible({ timeout: 15000 });
      
      // Should still be on professional detail page
      await expect(
        authenticatedPage.locator("h1").first()
      ).toBeVisible({ timeout: 15000 });
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
    
    // Parse balance (handle various formats: "$10.00", "10 coins", etc.)
    const balanceMatch = walletText?.match(/[\d.]+/);
    const balance = balanceMatch ? parseFloat(balanceMatch[0]) : 0;
    
    // Browse to a professional
    await browsePage.goto();
    const proCount = await browsePage.getProfessionalCount();
    test.skip(proCount === 0, "No professionals available");
    
    await browsePage.viewProfessional(0);
    
    // Check if price is displayed
    const priceElement = authenticatedPage.locator(
      "[data-testid='price']"
    ).first();
    
    if (await priceElement.isVisible()) {
      const priceText = await priceElement.textContent();
      const priceMatch = priceText?.match(/[\d.]+/);
      const price = priceMatch ? parseFloat(priceMatch[0]) : 0;
      
      // If balance is insufficient, should show wallet top-up option
      if (balance < price) {
        const topupButton = authenticatedPage.getByRole("button", {
          name: /top up|add funds|insufficient/i
        }).first();
        
        await expect(topupButton).toBeVisible({ timeout: 15000 });
      }
    }
  });
});
