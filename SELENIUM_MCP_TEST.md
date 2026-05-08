# Selenium MCP Test & Verification

## ✅ Setup Status

Selenium MCP has been successfully configured in your Kiro environment.

**Configuration file:** `.kiro/settings/mcp.json`

```json
{
  "selenium": {
    "command": "npx",
    "args": ["-y", "@angiejones/mcp-selenium@latest"]
  }
}
```

## 📋 Available Selenium MCP Tools

### Browser Lifecycle
- **start_browser** - Launch Chrome, Firefox, Edge, or Safari
- **close_session** - Close the browser session

### Navigation & Interaction
- **navigate** - Go to a URL
- **interact** - Click, double-click, right-click, or hover on elements
- **send_keys** - Type text into input fields
- **press_key** - Press keyboard keys (Enter, Tab, etc.)

### Element Inspection
- **get_element_text** - Extract text from elements
- **get_element_attribute** - Get element attributes (href, value, class, etc.)
- **take_screenshot** - Capture page screenshots

### Advanced Actions
- **execute_script** - Run JavaScript in the browser
- **upload_file** - Upload files via file inputs
- **window** - Manage browser windows and tabs
- **frame** - Switch between frames
- **alert** - Handle browser alerts and dialogs

### Cookie & Session Management
- **add_cookie** - Add cookies to the browser
- **get_cookies** - Retrieve cookies
- **delete_cookie** - Delete cookies

### Diagnostics
- **diagnostics** - Get console logs, errors, and network activity

## 🧪 Example Usage Scenarios

### Scenario 1: Test ProNeighbor Login Flow
```
1. start_browser(browser: "chrome")
2. navigate(url: "https://proneighbor.local/login")
3. send_keys(by: "id", value: "email", text: "test@example.com")
4. send_keys(by: "id", value: "password", text: "password123")
5. interact(action: "click", by: "css", value: "button[type='submit']")
6. take_screenshot(outputPath: "./login-success.png")
7. close_session()
```

### Scenario 2: Scrape Service Listings
```
1. start_browser(browser: "chrome", options: {headless: true})
2. navigate(url: "https://proneighbor.local/browse")
3. execute_script(script: "return document.querySelectorAll('.service-card').length")
4. get_element_text(by: "css", value: ".service-card:first-child .title")
5. take_screenshot()
6. close_session()
```

### Scenario 3: Admin Panel Testing
```
1. start_browser(browser: "chrome")
2. navigate(url: "https://proneighbor.local/admin/users")
3. interact(action: "click", by: "xpath", value: "//button[contains(text(), 'Add User')]")
4. send_keys(by: "name", value: "username", text: "newuser")
5. interact(action: "click", by: "css", value: ".modal button.save")
6. take_screenshot()
7. close_session()
```

## 🚀 How to Use with Kiro

### Method 1: Direct MCP Tool Calls
When you ask me to perform browser automation, I can now use Selenium MCP tools directly:

```
"Open Chrome, go to github.com, and take a screenshot"
```

I will:
1. Call `start_browser(browser: "chrome")`
2. Call `navigate(url: "https://github.com")`
3. Call `take_screenshot()`
4. Call `close_session()`

### Method 2: E2E Testing
Create test files that use Selenium MCP for automated testing:

```javascript
// e2e/login.test.ts
import { test, expect } from '@playwright/test';

test('ProNeighbor login flow', async () => {
  // Can be adapted to use Selenium MCP tools
  // for cross-browser testing
});
```

### Method 3: Automation Scripts
Create scripts for repetitive tasks:

```bash
# Scrape all services
steel browser start --session scraper
steel browser navigate https://proneighbor.local/browse
# ... use Selenium MCP tools
```

## 📊 Comparison: Selenium MCP vs Playwright MCP

| Feature | Selenium MCP | Playwright MCP |
|---------|-------------|----------------|
| Browsers | Chrome, Firefox, Edge, Safari | Chromium, Firefox, WebKit |
| Headless | Yes | Yes |
| Speed | Moderate | Fast |
| Stability | Very stable | Very stable |
| Use Case | Cross-browser testing | Modern web testing |
| Industry Standard | Yes (WebDriver) | Yes (Modern) |

## ✨ Next Steps

1. **Test with ProNeighbor**: Ask me to automate a login flow or scrape service listings
2. **Create E2E tests**: Build automated tests for critical user flows
3. **Admin automation**: Automate repetitive admin tasks
4. **Documentation**: Generate screenshots for documentation

## 🔧 Troubleshooting

If Selenium MCP doesn't work:

1. **Check Node.js**: `node --version` (requires v14+)
2. **Check npm**: `npm --version`
3. **Verify config**: Check `.kiro/settings/mcp.json` is valid JSON
4. **Restart Kiro**: Reload the MCP servers
5. **Check browser drivers**: Ensure Chrome/Firefox/Edge is installed

## 📚 Resources

- [Selenium MCP GitHub](https://github.com/angiejones/mcp-selenium)
- [Selenium WebDriver Docs](https://www.selenium.dev/documentation/)
- [MCP Protocol Docs](https://modelcontextprotocol.io/)

---

**Status**: ✅ Ready to use
**Last Updated**: May 8, 2026
