/**
 * Global teardown for Playwright tests
 * Runs once after all tests complete
 */
export default async function globalTeardown() {
  console.log("🧹 Global Teardown: Cleaning up test artifacts");
  
  // Clean up any test data created during tests
  // For example: delete test users, clear test bookings, etc.
  
  // Note: In a real scenario, you might:
  // - Call an API to clean up test data
  // - Reset database to known state
  // - Clear temporary files
  
  console.log("✅ Global teardown complete");
}
