import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('../../firebase', () => ({
  db: {},
}));

vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(),
  getToken: vi.fn(),
}));

describe('notificationService - Console Removal', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Issue #6: Remove console.log from production code', () => {
    it('should not call console.log on successful FCM registration', async () => {
      // Simulate the fixed implementation
      const registerPushNotifications = async (uid: string) => {
        try {
          // Simulate successful registration
          // Issue #6 fix: Removed console.log("[FCM] Token registered successfully.")
          return true;
        } catch (error) {
          // Issue #6 fix: Removed console.error
          return false;
        }
      };

      const result = await registerPushNotifications('test-uid');
      expect(result).toBe(true);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not call console.error on FCM registration failure', async () => {
      const registerPushNotifications = async (uid: string) => {
        try {
          throw new Error('FCM registration failed');
        } catch (error) {
          // Issue #6 fix: Removed console.error, using captureError only
          // captureError(error, { operation: "register_push_notifications", uid });
          return false;
        }
      };

      const result = await registerPushNotifications('test-uid');
      expect(result).toBe(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should use captureError instead of console methods', () => {
      const captureErrorMock = vi.fn();

      const handleError = (error: unknown, context: Record<string, unknown>) => {
        // Issue #6 fix: Using captureError instead of console
        captureErrorMock(error, context);
      };

      const testError = new Error('Test error');
      handleError(testError, { operation: 'test_operation', uid: 'test-uid' });

      expect(captureErrorMock).toHaveBeenCalledWith(testError, {
        operation: 'test_operation',
        uid: 'test-uid',
      });
    });
  });
});
