/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
import { FullConfig } from "@playwright/test";

export default async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  console.log(`🚀 Global Setup: Using baseURL ${baseURL}`);
  
  // Verify the test server is reachable
  try {
    const response = await fetch(baseURL as string, { method: "HEAD" });
    if (!response.ok) {
      console.warn(`⚠️  Server returned status ${response.status}`);
    } else {
      console.log("✅ Test server is reachable");
    }
  } catch (error) {
    console.warn(`⚠️  Could not reach test server: ${error}`);
    console.log("💡 Ensure 'npm run dev' is running or E2E_BASE_URL is set correctly");
  }
  
  // Store any global state that tests might need
  // For example: test user credentials, API tokens, etc.
  const testCredentials = {
    testResident: {
      email: process.env.TEST_RESIDENT_EMAIL || "resident@test.proneighbor.app",
      password: process.env.TEST_RESIDENT_PASSWORD || "Test@123456",
    },
    testProfessional: {
      email: process.env.TEST_PROFESSIONAL_EMAIL || "pro@test.proneighbor.app",
      password: process.env.TEST_PROFESSIONAL_PASSWORD || "Test@123456",
    },
  };
  
  // Save to a temp file for tests to read if needed
  // Note: In production, use environment variables or a secure vault
  console.log("✅ Global setup complete");
}
