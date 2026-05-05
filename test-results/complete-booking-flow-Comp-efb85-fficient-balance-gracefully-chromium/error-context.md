# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: complete-booking-flow.spec.ts >> Complete Booking Flow >> should handle insufficient balance gracefully
- Location: e2e\complete-booking-flow.spec.ts:245:3

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

```
Tearing down "context" exceeded the test timeout of 30000ms.
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
        - textbox "you@example.com" [ref=e27]: test@proneighbor.test
      - generic [ref=e28]:
        - generic [ref=e29]: Password
        - textbox "••••••••" [ref=e30]: TestPassword123!
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