# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login-flow.spec.ts >> Login Flow >> should show validation errors for empty form
- Location: e2e\login-flow.spec.ts:30:3

# Error details

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
    - button "Continue with Google" [ref=e16] [cursor=pointer]:
      - img [ref=e17]
      - text: Continue with Google
    - generic [ref=e22]: or sign in with email
    - generic [ref=e23]:
      - generic [ref=e24]:
        - generic [ref=e25]: Email
        - textbox "you@example.com" [active] [ref=e26]
      - generic [ref=e27]:
        - generic [ref=e28]: Password
        - textbox "••••••••" [ref=e29]
      - button "Sign In" [ref=e30]
    - paragraph [ref=e31]:
      - link "Forgot password?" [ref=e32] [cursor=pointer]:
        - /url: /forgot-password
    - paragraph [ref=e33]:
      - text: Don't have an account?
      - link "Create one" [ref=e34] [cursor=pointer]:
        - /url: /register
    - paragraph [ref=e35]:
      - text: Need help?
      - link "Contact Support" [ref=e36] [cursor=pointer]:
        - /url: /contact
```