# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browse.spec.ts >> Browse Professionals >> clear filters resets to default view
- Location: e2e\browse.spec.ts:116:3

# Error details

```
Error: expect(page).not.toHaveURL(expected) failed

Expected pattern: not /login|auth/
Received string: "http://localhost:5173/login"
Timeout: 5000ms

Call log:
  - Expect "not toHaveURL" with timeout 5000ms
    9 × unexpected value "http://localhost:5173/login"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - link "Logo ProNeighbor" [ref=e5] [cursor=pointer]:
      - /url: /
      - img "Logo" [ref=e6]
      - text: ProNeighbor
    - heading "Your community, your experts." [level=2] [ref=e7]
    - paragraph [ref=e8]: Connect with verified local professionals — CA, Tutor, Health experts, and more — within your neighborhood.
    - generic [ref=e9]: ● Launch in May 2026 for Park Street Residents
  - generic [ref=e11]:
    - link "Logo" [ref=e12] [cursor=pointer]:
      - /url: /
      - img "Logo" [ref=e13]
    - heading "Welcome back" [level=1] [ref=e14]
    - paragraph [ref=e15]: Sign in to your ProNeighbor account
    - generic [ref=e16]: Too many attempts. Try again later.
    - button "Continue with Google" [ref=e17] [cursor=pointer]:
      - img [ref=e18]
      - text: Continue with Google
    - generic [ref=e23]: or sign in with email
    - generic [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e26]: Email
        - textbox "you@example.com" [ref=e27]: resident@test.proneighbor.app
      - generic [ref=e28]:
        - generic [ref=e29]: Password
        - textbox "••••••••" [ref=e30]: Test@123456
      - button "Sign In" [ref=e31]
    - paragraph [ref=e32]:
      - link "Forgot password?" [ref=e33] [cursor=pointer]:
        - /url: /forgot-password
    - paragraph [ref=e34]:
      - text: Don't have an account?
      - link "Create one" [ref=e35] [cursor=pointer]:
        - /url: /register
    - paragraph [ref=e36]:
      - text: Need help?
      - link "Contact Support" [ref=e37] [cursor=pointer]:
        - /url: /contact
```

# Test source

```ts
  1   | import { Page, Locator, expect } from "@playwright/test";
  2   | import { BasePage } from "./base.page";
  3   | 
  4   | /**
  5   |  * Login Page Object Model
  6   |  */
  7   | export class LoginPage extends BasePage {
  8   |   readonly emailInput: Locator;
  9   |   readonly passwordInput: Locator;
  10  |   readonly signInButton: Locator;
  11  |   readonly forgotPasswordLink: Locator;
  12  |   readonly signUpLink: Locator;
  13  |   readonly rememberMeCheckbox: Locator;
  14  | 
  15  |   constructor(page: Page) {
  16  |     super(page);
  17  |     
  18  |     this.emailInput = page.locator("input[type='email'], input[name='email'], #email").first();
  19  |     this.passwordInput = page.locator("input[type='password'], input[name='password'], #password").first();
  20  |     this.signInButton = page.getByRole("button", { name: /sign in|log in/i }).first();
  21  |     this.forgotPasswordLink = page.getByRole("link", { name: /forgot password/i }).first();
  22  |     this.signUpLink = page.getByRole("link", { name: /sign up|register/i }).first();
  23  |     this.rememberMeCheckbox = page.locator("input[type='checkbox'], #remember-me").first();
  24  |   }
  25  | 
  26  |   /**
  27  |    * Navigate to login page
  28  |    */
  29  |   async goto(): Promise<void> {
  30  |     await super.goto("/login");
  31  |     await this.waitForLoad();
  32  |   }
  33  | 
  34  |   /**
  35  |    * Fill login form with credentials
  36  |    */
  37  |   async fillCredentials(email: string, password: string): Promise<void> {
  38  |     await this.fillInput(this.emailInput, email);
  39  |     await this.fillInput(this.passwordInput, password);
  40  |   }
  41  | 
  42  |   /**
  43  |    * Submit the login form
  44  |    */
  45  |   async submit(): Promise<void> {
  46  |     await this.safeClick(this.signInButton);
  47  |   }
  48  | 
  49  |   /**
  50  |    * Complete login flow with credentials
  51  |    */
  52  |   async login(email: string, password: string): Promise<void> {
  53  |     await this.goto();
  54  |     await this.fillCredentials(email, password);
  55  |     await this.submit();
  56  |     await this.waitForLoadingComplete();
  57  |   }
  58  | 
  59  |   /**
  60  |    * Assert login form is visible
  61  |    */
  62  |   async assertFormVisible(): Promise<void> {
  63  |     await expect(this.emailInput).toBeVisible();
  64  |     await expect(this.passwordInput).toBeVisible();
  65  |     await expect(this.signInButton).toBeVisible();
  66  |   }
  67  | 
  68  |   /**
  69  |    * Assert successful login (redirected to dashboard)
  70  |    */
  71  |   async assertLoginSuccess(): Promise<void> {
> 72  |     await expect(this.page).not.toHaveURL(/login|auth/);
      |                                 ^ Error: expect(page).not.toHaveURL(expected) failed
  73  |     await expect(this.page).toHaveURL(/dashboard|home|browse/);
  74  |   }
  75  | 
  76  |   /**
  77  |    * Assert login failure with error message
  78  |    */
  79  |   async assertLoginFailure(expectedError?: string): Promise<void> {
  80  |     await expect(this.errorBox.first()).toBeVisible();
  81  |     if (expectedError) {
  82  |       await expect(this.errorBox.first()).toContainText(expectedError);
  83  |     }
  84  |   }
  85  | 
  86  |   /**
  87  |    * Click forgot password link
  88  |    */
  89  |   async clickForgotPassword(): Promise<void> {
  90  |     await this.safeClick(this.forgotPasswordLink);
  91  |   }
  92  | 
  93  |   /**
  94  |    * Click sign up link
  95  |    */
  96  |   async clickSignUp(): Promise<void> {
  97  |     await this.safeClick(this.signUpLink);
  98  |   }
  99  | }
  100 | 
```