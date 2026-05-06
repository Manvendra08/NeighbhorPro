# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Authentication Flow >> successful login redirects to dashboard
- Location: e2e\auth.spec.ts:38:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid=\'wallet-balance\'], .wallet-balance, #wallet')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[data-testid=\'wallet-balance\'], .wallet-balance, #wallet')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - link "Logo ProNeighbor" [ref=e6] [cursor=pointer]:
        - /url: /
        - generic [ref=e7]:
          - img "Logo" [ref=e8]
          - generic [ref=e9]: ProNeighbor
      - button "Toggle sidebar" [ref=e10] [cursor=pointer]:
        - img [ref=e11]
    - navigation [ref=e12]:
      - generic [ref=e13]: Menu
      - link "Dashboard" [ref=e14] [cursor=pointer]:
        - /url: /dashboard
        - img [ref=e15]
        - generic [ref=e18]: Dashboard
      - link "Browse Pros" [ref=e19] [cursor=pointer]:
        - /url: /browse
        - img [ref=e20]
        - generic [ref=e23]: Browse Pros
      - link "My Bookings" [ref=e24] [cursor=pointer]:
        - /url: /bookings
        - img [ref=e25]
        - generic [ref=e28]: My Bookings
      - link "Messages" [ref=e29] [cursor=pointer]:
        - /url: /messages
        - img [ref=e30]
        - generic [ref=e32]: Messages
      - link "Wallet 500 NC" [ref=e33] [cursor=pointer]:
        - /url: /wallet
        - img [ref=e34]
        - generic [ref=e36]: Wallet
        - generic [ref=e37]: 500 NC
      - link "My Account" [ref=e38] [cursor=pointer]:
        - /url: /account
        - img [ref=e39]
        - generic [ref=e42]: My Account
      - link "Support" [ref=e43] [cursor=pointer]:
        - /url: /support
        - img [ref=e44]
        - generic [ref=e47]: Support
    - generic [ref=e49]: © 2026 ProNeighbor
  - generic [ref=e50]:
    - banner [ref=e51]:
      - generic [ref=e54]: 14+ neighbors are using ProNeighbor right now!
      - generic [ref=e55]:
        - link "🪙 500 NC" [ref=e56] [cursor=pointer]:
          - /url: /wallet
          - generic [ref=e57]: 🪙
          - text: 500 NC
        - button "Notifications" [ref=e59] [cursor=pointer]:
          - img [ref=e60]
        - button "Open user menu" [ref=e63] [cursor=pointer]: CU
    - generic [ref=e64]:
      - generic [ref=e65]:
        - text: ⚠️ Verify your email —
        - strong [ref=e66]: client1@proneighbor.in
      - button "Resend" [ref=e67] [cursor=pointer]
    - generic [ref=e70]:
      - generic [ref=e72]:
        - generic [ref=e73]:
          - heading "Welcome back, Client 👋" [level=1] [ref=e74]
          - paragraph [ref=e75]: Still missing Profile photo.
        - generic [ref=e76]:
          - generic [ref=e78]:
            - strong [ref=e79]: 65%
            - generic [ref=e80]: complete
          - generic [ref=e81]:
            - generic [ref=e82]: Finish your profile and earn 20 NC
            - generic [ref=e83]: "Missing: Profile photo"
            - generic [ref=e84]:
              - link "Complete now" [ref=e85] [cursor=pointer]:
                - /url: /account
              - button "Dismiss" [ref=e86] [cursor=pointer]
      - generic [ref=e87]:
        - generic [ref=e88]:
          - generic [ref=e89]:
            - generic [ref=e90]:
              - heading "This Week" [level=2] [ref=e91]
              - paragraph [ref=e92]: See what is coming up over next 7 days.
            - link "Bookings" [ref=e94] [cursor=pointer]:
              - /url: /bookings
          - generic [ref=e97]:
            - text: Nothing booked this week.
            - link "Browse Professionals →" [ref=e98] [cursor=pointer]:
              - /url: /browse
        - generic [ref=e100]:
          - generic [ref=e101]:
            - heading "Recommended Pros" [level=2] [ref=e102]
            - paragraph [ref=e103]: Trust signals from your neighborhood.
          - link "Browse" [ref=e105] [cursor=pointer]:
            - /url: /browse
      - generic [ref=e106]:
        - generic [ref=e108]:
          - heading "Your Snapshot" [level=2] [ref=e109]
          - paragraph [ref=e110]: Wallet, bookings, and trust signals.
        - generic [ref=e112]:
          - link "🪙 500 NC NC Balance Wallet rewards + credits" [ref=e113] [cursor=pointer]:
            - /url: /wallet
            - generic [ref=e115]: 🪙
            - generic [ref=e116]: 500 NC
            - generic [ref=e117]: NC Balance
            - generic [ref=e118]: Wallet rewards + credits
          - link "📅 0 Upcoming Pending + confirmed sessions" [ref=e119] [cursor=pointer]:
            - /url: /bookings
            - generic [ref=e120]:
              - generic [ref=e121]: 📅
              - img [ref=e122]
            - generic [ref=e123]: "0"
            - generic [ref=e124]: Upcoming
            - generic [ref=e125]: Pending + confirmed sessions
          - link "⭐ — Average Rating 0 total reviews 5★ 0 0 4★ 0 0 3★ 0 0 2★ 0 0 1★ 0 0" [ref=e126] [cursor=pointer]:
            - /url: /profile
            - generic [ref=e127]:
              - generic [ref=e128]: ⭐
              - img [ref=e129]
            - generic [ref=e130]: —
            - generic [ref=e131]: Average Rating
            - generic [ref=e132]: 0 total reviews
            - generic [ref=e133]:
              - generic [ref=e134]:
                - generic [ref=e135]: 5★
                - progressbar "5 star reviews" [ref=e136]
                - strong [ref=e137]: "0"
              - generic [ref=e138]:
                - generic [ref=e139]: 4★
                - progressbar "4 star reviews" [ref=e140]
                - strong [ref=e141]: "0"
              - generic [ref=e142]:
                - generic [ref=e143]: 3★
                - progressbar "3 star reviews" [ref=e144]
                - strong [ref=e145]: "0"
              - generic [ref=e146]:
                - generic [ref=e147]: 2★
                - progressbar "2 star reviews" [ref=e148]
                - strong [ref=e149]: "0"
              - generic [ref=e150]:
                - generic [ref=e151]: 1★
                - progressbar "1 star reviews" [ref=e152]
                - strong [ref=e153]: "0"
          - link "📦 0 Total Bookings Sessions booked so far" [ref=e154] [cursor=pointer]:
            - /url: /bookings?subTab=past
            - generic [ref=e155]:
              - generic [ref=e156]: 📦
              - img [ref=e157]
            - generic [ref=e158]: "0"
            - generic [ref=e159]: Total Bookings
            - generic [ref=e160]: Sessions booked so far
      - generic [ref=e161]:
        - generic [ref=e162]:
          - generic [ref=e163]:
            - heading "Browse by Category" [level=2] [ref=e164]
            - paragraph [ref=e165]: Jump straight into popular neighborhood needs.
          - link "Browse all" [ref=e167] [cursor=pointer]:
            - /url: /browse
        - generic [ref=e169]:
          - link "Tuition & Coaching" [ref=e170] [cursor=pointer]:
            - /url: /browse?category=Tuition%20%26%20Coaching
            - generic [ref=e171]: 📚
            - generic [ref=e172]: Tuition & Coaching
          - link "Yoga & Fitness" [ref=e173] [cursor=pointer]:
            - /url: /browse?category=Yoga%20%26%20Fitness
            - generic [ref=e174]: 🧘
            - generic [ref=e175]: Yoga & Fitness
          - link "Music & Dance" [ref=e176] [cursor=pointer]:
            - /url: /browse?category=Music%20%26%20Dance
            - generic [ref=e177]: 🎵
            - generic [ref=e178]: Music & Dance
          - link "Language Classes" [ref=e179] [cursor=pointer]:
            - /url: /browse?category=Language%20Classes
            - generic [ref=e180]: 🗣️
            - generic [ref=e181]: Language Classes
          - link "Nutrition & Diet" [ref=e182] [cursor=pointer]:
            - /url: /browse?category=Nutrition%20%26%20Diet
            - generic [ref=e183]: 🥗
            - generic [ref=e184]: Nutrition & Diet
          - link "Tax & CA" [ref=e185] [cursor=pointer]:
            - /url: /browse?category=Tax%20%26%20CA
            - generic [ref=e186]: 📊
            - generic [ref=e187]: Tax & CA
          - link "Legal Advisory" [ref=e188] [cursor=pointer]:
            - /url: /browse?category=Legal%20Advisory
            - generic [ref=e189]: ⚖️
            - generic [ref=e190]: Legal Advisory
          - link "Accounting & GST" [ref=e191] [cursor=pointer]:
            - /url: /browse?category=Accounting%20%26%20GST
            - generic [ref=e192]: 💹
            - generic [ref=e193]: Accounting & GST
      - generic [ref=e194]:
        - generic [ref=e195]:
          - generic [ref=e196]:
            - heading "Neighborhood Feed" [level=2] [ref=e197]
            - paragraph [ref=e198]: Posts from near Wisdom World
          - button "Collapse" [ref=e200] [cursor=pointer]
        - generic [ref=e202]:
          - generic [ref=e203]:
            - generic [ref=e204]:
              - generic [ref=e205]: ✍️
              - generic [ref=e206]: Share with your neighborhood
            - textbox "What's on your mind? Ask for recommendations, share updates…" [ref=e207]
            - generic [ref=e208]:
              - button "😊" [ref=e210] [cursor=pointer]
              - button "Post" [disabled] [ref=e211]
          - generic [ref=e212]:
            - generic [ref=e213]: 0 live posts
            - generic [ref=e214]: Composer and moderation flow unchanged
          - generic [ref=e216]:
            - strong [ref=e217]: No posts yet
            - generic [ref=e218]: Be first to share something with your neighbors.
```

# Test source

```ts
  1  | import { test, expect } from "./fixtures/test-fixtures";
  2  | 
  3  | test.describe("Authentication Flow", () => {
  4  |   test("landing page loads and displays sign-in CTA", async ({ page, loginPage }) => {
  5  |     await page.goto("/");
  6  |     await loginPage.waitForLoad();
  7  |     
  8  |     await loginPage.assertTitleContains(/ProNeighbor|NeighbourPro/i);
  9  |     await expect(loginPage.signInButton).toBeVisible();
  10 |     await expect(loginPage.signUpButton).toBeVisible();
  11 |   });
  12 | 
  13 |   test("unauthenticated user is redirected from protected routes", async ({ page, dashboardPage }) => {
  14 |     await page.goto("/dashboard");
  15 |     await dashboardPage.waitForLoad();
  16 |     
  17 |     await dashboardPage.assertRedirected();
  18 |   });
  19 | 
  20 |   test("login page renders with required form fields", async ({ loginPage }) => {
  21 |     await loginPage.goto();
  22 |     await loginPage.assertFormVisible();
  23 |     
  24 |     await expect(loginPage.emailInput).toBeVisible({ timeout: 15000 });
  25 |     await expect(loginPage.passwordInput).toBeVisible({ timeout: 15000 });
  26 |     await expect(loginPage.signInButton).toBeVisible({ timeout: 15000 });
  27 |   });
  28 | 
  29 |   test("displays error message on invalid credentials", async ({ loginPage }) => {
  30 |     await loginPage.login("notreal@example.com", "wrongpassword");
  31 |     
  32 |     await loginPage.assertLoginFailure();
  33 |     const errorMessage = await loginPage.getErrorMessage();
  34 |     expect(errorMessage).toBeTruthy();
  35 |     expect(errorMessage).toMatch(/invalid|incorrect|error|failed/i);
  36 |   });
  37 | 
  38 |   test("successful login redirects to dashboard", async ({ 
  39 |     page, 
  40 |     loginPage, 
  41 |     dashboardPage 
  42 |   }, testInfo) => {
  43 |     // Skip if test credentials not configured
  44 |     test.skip(
  45 |       !process.env.TEST_RESIDENT_EMAIL, 
  46 |       "Test credentials not configured. Set TEST_RESIDENT_EMAIL and TEST_RESIDENT_PASSWORD env vars."
  47 |     );
  48 | 
  49 |     const email = process.env.TEST_RESIDENT_EMAIL!;
  50 |     const password = process.env.TEST_RESIDENT_PASSWORD!;
  51 |     
  52 |     await loginPage.login(email, password);
  53 |     await loginPage.assertLoginSuccess();
  54 |     
  55 |     await dashboardPage.waitForDataLoad();
  56 |     await dashboardPage.assertLoaded();
  57 |     
  58 |     // Verify user-specific content is visible
  59 |     await expect(dashboardPage.welcomeMessage).toBeVisible();
> 60 |     await expect(dashboardPage.walletBalance).toBeVisible();
     |                                               ^ Error: expect(locator).toBeVisible() failed
  61 |   });
  62 | 
  63 |   test("forgot password flow is accessible", async ({ loginPage, page }) => {
  64 |     await loginPage.goto();
  65 |     
  66 |     await expect(loginPage.forgotPasswordLink).toBeVisible({ timeout: 15000 });
  67 |     await loginPage.clickForgotPassword();
  68 |     
  69 |     // Should navigate to password reset page or show modal
  70 |     await expect(
  71 |       page.locator("text=/reset password|forgot password|enter your email/i").first()
  72 |     ).toBeVisible({ timeout: 15000 });
  73 |   });
  74 | 
  75 |   test("navigation from login to signup works", async ({ loginPage, page }) => {
  76 |     await loginPage.goto();
  77 |     
  78 |     // Use getByRole to find signup link more reliably
  79 |     const signupLink = page.getByRole('link', { name: /sign up|register|create/i }).first();
  80 |     await expect(signupLink).toBeVisible({ timeout: 15000 });
  81 |     await signupLink.click();
  82 |     
  83 |     // Should navigate to signup page
  84 |     await expect(page).toHaveURL(/signup|register|auth\/sign-up/, { timeout: 15000 });
  85 |   });
  86 | });
  87 | 
```