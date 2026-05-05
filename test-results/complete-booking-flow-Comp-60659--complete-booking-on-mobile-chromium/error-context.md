# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: complete-booking-flow.spec.ts >> Complete Booking Flow - Mobile >> should complete booking on mobile
- Location: e2e\complete-booking-flow.spec.ts:308:3

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - text: ●
  - generic [ref=e5]:
    - link "Logo" [ref=e6] [cursor=pointer]:
      - /url: /
      - img "Logo" [ref=e7]
    - heading "Welcome back" [level=1] [ref=e8]
    - paragraph [ref=e9]: Sign in to your ProNeighbor account
    - generic [ref=e10]: Too many attempts. Try again later.
    - button "Continue with Google" [ref=e11] [cursor=pointer]:
      - img [ref=e12]
      - text: Continue with Google
    - generic [ref=e17]: or sign in with email
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]: Email
        - textbox "you@example.com" [ref=e21]: test@proneighbor.test
      - generic [ref=e22]:
        - generic [ref=e23]: Password
        - textbox "••••••••" [ref=e24]: TestPassword123!
      - button "Sign In" [ref=e25]
    - paragraph [ref=e26]:
      - link "Forgot password?" [ref=e27] [cursor=pointer]:
        - /url: /forgot-password
    - paragraph [ref=e28]:
      - text: Don't have an account?
      - link "Create one" [ref=e29] [cursor=pointer]:
        - /url: /register
    - paragraph [ref=e30]:
      - text: Need help?
      - link "Contact Support" [ref=e31] [cursor=pointer]:
        - /url: /contact
```

# Test source

```ts
  205 |       const bookButton = page.locator('button:has-text("Book"), button:has-text("Consultation")');
  206 |       await bookButton.click();
  207 | 
  208 |       await page.waitForURL(/\/book\//, { timeout: 10000 });
  209 | 
  210 |       // Fill in booking form
  211 |       const tomorrow = new Date();
  212 |       tomorrow.setDate(tomorrow.getDate() + 1);
  213 |       const tomorrowStr = tomorrow.toISOString().split('T')[0];
  214 | 
  215 |       const dateInput = page.locator('input[type="date"]');
  216 |       if (await dateInput.isVisible()) {
  217 |         await dateInput.fill(tomorrowStr);
  218 |         await page.waitForTimeout(2000);
  219 | 
  220 |         const timeSlotSelect = page.locator('select[id*="time"], select:has-text("Select")');
  221 |         if (await timeSlotSelect.isVisible()) {
  222 |           const options = await timeSlotSelect.locator('option').count();
  223 |           if (options > 1) {
  224 |             await timeSlotSelect.selectOption({ index: 1 });
  225 |           }
  226 |         }
  227 | 
  228 |         const notesTextarea = page.locator('textarea[id*="notes"], textarea[id*="brief"]');
  229 |         if (await notesTextarea.isVisible()) {
  230 |           await notesTextarea.fill('Test booking');
  231 |         }
  232 | 
  233 |         const continueButton = page.locator('button:has-text("Continue")');
  234 |         await continueButton.click();
  235 | 
  236 |         await page.waitForTimeout(2000);
  237 | 
  238 |         // Check for booking summary elements
  239 |         const hasSummary = await page.locator('text=/professional|service|date|time|price|nc/i').isVisible();
  240 |         expect(hasSummary).toBeTruthy();
  241 |       }
  242 |     }
  243 |   });
  244 | 
  245 |   test('should handle insufficient balance gracefully', async ({ page }) => {
  246 |     await page.goto('/browse');
  247 |     await page.waitForTimeout(2000);
  248 | 
  249 |     // Find a paid service
  250 |     const paidService = page.locator('[data-testid="service-card"]:has-text("NC"), .service-card:has-text("NC")').first();
  251 | 
  252 |     if (await paidService.isVisible()) {
  253 |       await paidService.click();
  254 |       await page.waitForURL(/\/pro\/|\/service\//, { timeout: 10000 });
  255 | 
  256 |       const bookButton = page.locator('button:has-text("Book"), button:has-text("Consultation")');
  257 |       await bookButton.click();
  258 | 
  259 |       await page.waitForURL(/\/book\//, { timeout: 10000 });
  260 | 
  261 |       // Fill in form and try to book
  262 |       const tomorrow = new Date();
  263 |       tomorrow.setDate(tomorrow.getDate() + 1);
  264 |       const tomorrowStr = tomorrow.toISOString().split('T')[0];
  265 | 
  266 |       const dateInput = page.locator('input[type="date"]');
  267 |       if (await dateInput.isVisible()) {
  268 |         await dateInput.fill(tomorrowStr);
  269 |         await page.waitForTimeout(2000);
  270 | 
  271 |         const timeSlotSelect = page.locator('select[id*="time"]');
  272 |         if (await timeSlotSelect.isVisible()) {
  273 |           const options = await timeSlotSelect.locator('option').count();
  274 |           if (options > 1) {
  275 |             await timeSlotSelect.selectOption({ index: 1 });
  276 |           }
  277 |         }
  278 | 
  279 |         const continueButton = page.locator('button:has-text("Continue")');
  280 |         await continueButton.click();
  281 | 
  282 |         await page.waitForTimeout(2000);
  283 | 
  284 |         // Should show insufficient balance warning or allow to continue
  285 |         const hasWarning = await page.locator('text=/insufficient|balance|wallet|top.*up/i').isVisible().catch(() => false);
  286 |         
  287 |         // Either shows warning or proceeds (depending on balance)
  288 |         expect(true).toBeTruthy(); // Test passes either way
  289 |       }
  290 |     }
  291 |   });
  292 | });
  293 | 
  294 | test.describe('Complete Booking Flow - Mobile', () => {
  295 |   test.use({ viewport: { width: 375, height: 667 } });
  296 | 
  297 |   const testEmail = 'test@proneighbor.test';
  298 |   const testPassword = 'TestPassword123!';
  299 | 
  300 |   async function login(page) {
  301 |     await page.goto('/login');
  302 |     await page.locator('input[type="email"]').fill(testEmail);
  303 |     await page.locator('input[type="password"]').fill(testPassword);
  304 |     await page.locator('button[type="submit"]').click();
> 305 |     await page.waitForURL(/\/dashboard/, { timeout: 10000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  306 |   }
  307 | 
  308 |   test('should complete booking on mobile', async ({ page }) => {
  309 |     await login(page);
  310 |     await page.goto('/browse');
  311 |     await page.waitForTimeout(2000);
  312 | 
  313 |     const firstService = page.locator('[data-testid="service-card"], .service-card, .card').first();
  314 | 
  315 |     if (await firstService.isVisible()) {
  316 |       await firstService.click();
  317 |       await page.waitForURL(/\/pro\/|\/service\//, { timeout: 10000 });
  318 | 
  319 |       const bookButton = page.locator('button:has-text("Book"), button:has-text("Consultation")');
  320 |       await bookButton.click();
  321 | 
  322 |       await page.waitForURL(/\/book\//, { timeout: 10000 });
  323 | 
  324 |       // Verify booking form is visible and usable on mobile
  325 |       const dateInput = page.locator('input[type="date"]');
  326 |       await expect(dateInput).toBeVisible();
  327 |     }
  328 |   });
  329 | });
  330 | 
```