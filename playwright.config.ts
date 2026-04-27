import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI to avoid resource contention */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Capture screenshot only on failure to save storage */
    screenshot: "only-on-failure",

    /* Record video on failure for debugging */
    video: "retain-on-failure",

    /* Set default timeout for actions */
    actionTimeout: 10_000,

    /* Set default timeout for navigation */
    navigationTimeout: 30_000,

    /* Ignore HTTPS errors in development */
    ignoreHTTPSErrors: true,

    /* Set locale and timezone for consistent testing */
    locale: "en-US",
    timezoneId: "America/New_York",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { 
        ...devices["Desktop Chrome"],
        /* Set viewport for consistent testing */
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "firefox",
      use: { 
        ...devices["Desktop Firefox"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "webkit",
      use: { 
        ...devices["Desktop Safari"],
        viewport: { width: 1280, height: 720 },
      },
    },
    /* Test mobile viewports */
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 60_000,
        stdout: "pipe",
        stderr: "pipe",
      },

  /* Global setup/teardown */
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  /* Configure test output directory */
  outputDir: "test-results/",

  /* Update snapshots in CI if needed */
  updateSnapshots: process.env.CI ? "none" : "missing",
});
