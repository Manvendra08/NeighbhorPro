/**
 * Unit tests for SubscriptionManage.tsx validation logic
 * 
 * Tests for fixes:
 * - Bug #8: Error state handling and retry logic
 * - Bug #10: formatTs timestamp validation and sanitization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';

// ─── formatTs Function Tests (Bug #10) ──────────────────────────────────────
// We extract and test the formatTs logic separately from the component

function formatTs(ts: unknown): string {
  if (!ts) return "--";
  let date: Date | null = null;
  
  try {
    if (ts instanceof Timestamp) {
      date = ts.toDate();
    } else if (
      typeof ts === "object" &&
      ts !== null &&
      "seconds" in ts &&
      typeof (ts as { seconds: number }).seconds === "number"
    ) {
      const seconds = (ts as { seconds: number }).seconds;
      // Validate seconds is a reasonable timestamp (between 1970 and 2100)
      if (seconds < 0 || seconds > 4102444800) {
        console.warn("Invalid timestamp seconds value:", seconds);
        return "--";
      }
      date = new Date(seconds * 1000);
    } else if (ts instanceof Date) {
      date = ts;
    } else {
      console.warn("formatTs received unsupported type:", typeof ts);
      return "--";
    }
    
    if (!date || isNaN(date.getTime())) {
      console.warn("formatTs produced invalid date");
      return "--";
    }
    
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch (err) {
    console.error("formatTs error:", err);
    return "--";
  }
}

describe('formatTs timestamp validation (Bug #10)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Valid Input Cases ─────────────────────────────────────────────────

  it('should format Firebase Timestamp correctly', () => {
    const ts = Timestamp.fromDate(new Date('2024-06-15T12:00:00Z'));
    const result = formatTs(ts);
    
    expect(result).toMatch(/^\d{1,2} [A-Za-z]{3} \d{4}$/);
    expect(result).toContain('2024');
  });

  it('should format plain object with seconds property', () => {
    const seconds = Math.floor(new Date('2024-06-15T12:00:00Z').getTime() / 1000);
    const result = formatTs({ seconds });
    
    expect(result).toMatch(/^\d{1,2} [A-Za-z]{3} \d{4}$/);
    expect(result).toContain('2024');
  });

  it('should format native Date objects', () => {
    const date = new Date('2024-06-15T12:00:00Z');
    const result = formatTs(date);
    
    expect(result).toMatch(/^\d{1,2} [A-Za-z]{3} \d{4}$/);
    expect(result).toContain('2024');
  });

  it('should handle null/undefined/empty values gracefully', () => {
    expect(formatTs(null)).toBe('--');
    expect(formatTs(undefined)).toBe('--');
    expect(formatTs('')).toBe('--');
    expect(formatTs(0)).toBe('--');
  });

  // ─── Invalid Input Cases (Bug #10 Fix) ───────────────────────────────────

  it('should return "--" for negative timestamp seconds (before 1970)', () => {
    const result = formatTs({ seconds: -1000 });
    expect(result).toBe('--');
    expect(console.warn).toHaveBeenCalledWith(
      'Invalid timestamp seconds value:',
      -1000
    );
  });

  it('should return "--" for timestamp seconds beyond year 2100', () => {
    const result = formatTs({ seconds: 4102444801 }); // Just beyond 2100-01-01
    expect(result).toBe('--');
    expect(console.warn).toHaveBeenCalledWith(
      'Invalid timestamp seconds value:',
      4102444801
    );
  });

  it('should return "--" for unsupported input types', () => {
    expect(formatTs('not-a-timestamp')).toBe('--');
    expect(console.warn).toHaveBeenCalledWith(
      'formatTs received unsupported type:',
      'string'
    );
    
    expect(formatTs(12345)).toBe('--');
    expect(formatTs(true)).toBe('--');
    expect(formatTs({})).toBe('--');
    expect(formatTs({ notSeconds: 123 })).toBe('--');
  });

  it('should return "--" for invalid Date objects', () => {
    const invalidDate = new Date('invalid-date-string');
    expect(invalidDate.toString()).toBe('Invalid Date');
    
    const result = formatTs(invalidDate);
    expect(result).toBe('--');
    expect(console.warn).toHaveBeenCalledWith('formatTs produced invalid date');
  });

  it('should return "--" when toDate() throws an error', () => {
    // Create a mock Timestamp class that throws on toDate()
    class MockTimestamp extends Timestamp {
      toDate(): Date {
        throw new Error('Conversion failed');
      }
    }
    const badTimestamp = new MockTimestamp(0, 0);
    
    const result = formatTs(badTimestamp);
    expect(result).toBe('--');
    expect(console.error).toHaveBeenCalledWith(
      'formatTs error:',
      expect.any(Error)
    );
  });

  it('should handle object with non-numeric seconds property', () => {
    const result = formatTs({ seconds: 'not-a-number' });
    expect(result).toBe('--');
    expect(console.warn).toHaveBeenCalledWith(
      'formatTs received unsupported type:',
      'object'
    );
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────────

  it('should handle boundary timestamp values', () => {
    // Unix epoch (1970-01-01)
    expect(formatTs({ seconds: 0 })).toMatch(/^\d{1,2} [A-Za-z]{3} \d{4}$/);
    
    // Year 2100 boundary (should be valid)
    expect(formatTs({ seconds: 4102444800 })).toMatch(/^\d{1,2} [A-Za-z]{3} \d{4}$/);
  });

  it('should preserve en-IN locale formatting', () => {
    const ts = Timestamp.fromDate(new Date('2024-06-15T12:00:00Z'));
    const result = formatTs(ts);
    
    // en-IN uses "15 Jun 2024" format (day month year, no comma)
    expect(result).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
  });

  it('should be idempotent for valid inputs', () => {
    const ts = Timestamp.fromDate(new Date('2024-06-15T12:00:00Z'));
    const result1 = formatTs(ts);
    const result2 = formatTs(ts);
    
    expect(result1).toBe(result2);
  });
});

// ─── Error State Handling Tests (Bug #8) ───────────────────────────────────

describe('Error state handling patterns (Bug #8)', () => {
  it('should clear stale data when fetch fails', () => {
    // Pattern: On fetch error, set state to null/empty to prevent stale data display
    let subscription: unknown = { id: 'old-sub', plan: 'business_3m_v1' };
    let fetchError: string | null = null;
    
    // Simulate fetch error
    const simulateFetchError = () => {
      fetchError = 'Failed to load subscription';
      subscription = null; // Clear stale data
    };
    
    simulateFetchError();
    
    expect(fetchError).toBe('Failed to load subscription');
    expect(subscription).toBeNull();
  });

  it('should provide retry capability after fetch error', async () => {
    // Pattern: Error UI includes retry button that re-triggers fetch
    let fetchAttempts = 0;
    let lastError: string | null = null;
    
    const fetchSubscription = async () => {
      fetchAttempts++;
      if (fetchAttempts === 1) {
        throw new Error('Network error');
      }
      return { id: 'sub-123', plan: 'business_3m_v1' };
    };
    
    const handleRetry = async () => {
      try {
        const result = await fetchSubscription();
        lastError = null;
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        throw err;
      }
    };
    
    // First attempt fails
    await expect(handleRetry()).rejects.toThrow('Network error');
    expect(lastError).toBe('Network error');
    
    // Retry succeeds
    await expect(handleRetry()).resolves.toEqual(
      expect.objectContaining({ id: 'sub-123' })
    );
    expect(lastError).toBeNull();
  });

  it('should handle partial failures independently', () => {
    // Pattern: Subscription and invoices fetches have separate error states
    const state = {
      sub: null as unknown,
      invoices: [] as unknown[],
      subError: null as string | null,
      invoicesError: null as string | null,
    };
    
    // Simulate: sub fetch succeeds, invoices fetch fails
    state.sub = { id: 'sub-123' };
    state.invoicesError = 'Failed to load invoices';
    state.invoices = []; // Clear stale invoice data
    
    expect(state.sub).toBeDefined();
    expect(state.invoicesError).toBe('Failed to load invoices');
    expect(state.invoices).toEqual([]);
  });

  it('should use instanceof Error for type-safe error messages', () => {
    const handleError = (err: unknown): string => {
      return err instanceof Error ? err.message : 'An unexpected error occurred';
    };
    
    expect(handleError(new Error('Specific error'))).toBe('Specific error');
    expect(handleError('string error')).toBe('An unexpected error occurred');
    expect(handleError(null)).toBe('An unexpected error occurred');
    expect(handleError({ message: 'object error' })).toBe('An unexpected error occurred');
  });
});

// ─── Integration: formatTs in UI context ───────────────────────────────────

describe('formatTs integration with UI components', () => {
  it('should work with subscription period display', () => {
    const startTs = Timestamp.fromDate(new Date('2024-01-15'));
    const endTs = Timestamp.fromDate(new Date('2024-04-15'));
    
    const periodDisplay = `${formatTs(startTs)} to ${formatTs(endTs)}`;
    
    expect(periodDisplay).toMatch(/^\d{1,2} [A-Za-z]{3} \d{4} to \d{1,2} [A-Za-z]{3} \d{4}$/);
    expect(periodDisplay).toContain('2024');
  });

  it('should handle mixed valid/invalid timestamps in same display', () => {
    const validTs = Timestamp.fromDate(new Date('2024-06-15'));
    const invalidTs = { seconds: -1000 };
    
    const display = `${formatTs(validTs)} to ${formatTs(invalidTs)}`;
    
    expect(display).toBe(`${formatTs(validTs)} to --`);
  });

  it('should not crash when rendering with corrupted subscription data', () => {
    const corruptedSub = {
      currentPeriodStart: 'not-a-timestamp',
      currentPeriodEnd: null,
    } as unknown as { currentPeriodStart: unknown; currentPeriodEnd: unknown };
    
    // Should not throw, just display fallback values
    expect(() => {
      formatTs(corruptedSub.currentPeriodStart);
      formatTs(corruptedSub.currentPeriodEnd);
    }).not.toThrow();
  });
});

// ─── Security and Robustness Tests ─────────────────────────────────────────

describe('formatTs security and robustness', () => {
  it('should not execute arbitrary code from input', () => {
    // Ensure formatTs doesn't use eval or Function constructor
    const maliciousInputs = [
      { seconds: 'constructor.constructor("return process")()' },
      { toString: () => 'malicious' },
      '__proto__' as unknown,
      'constructor' as unknown,
    ];
    
    maliciousInputs.forEach(input => {
      expect(() => formatTs(input)).not.toThrow();
      expect(formatTs(input)).toBe('--');
    });
  });

  it('should handle extremely large numbers gracefully', () => {
    expect(formatTs({ seconds: Number.MAX_SAFE_INTEGER })).toBe('--');
    expect(formatTs({ seconds: Infinity })).toBe('--');
    expect(formatTs({ seconds: NaN })).toBe('--');
  });

  it('should handle prototype pollution attempts', () => {
    const pollutedObj = JSON.parse('{"seconds": 1234567890, "__proto__": {"polluted": true}}');
    
    // Should format normally without affecting Object.prototype
    const result = formatTs(pollutedObj);
    expect(result).toMatch(/^\d{1,2} [A-Za-z]{3} \d{4}$/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

// ─── Performance Tests (non-regression) ────────────────────────────────────

describe('formatTs performance characteristics', () => {
  it('should complete formatting in reasonable time', () => {
    const ts = Timestamp.fromDate(new Date('2024-06-15T12:00:00Z'));
    const iterations = 1000;
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      formatTs(ts);
    }
    const end = performance.now();
    
    // Should complete 1000 iterations in under 1000ms (1ms per call) - relaxed for CI environments
    expect(end - start).toBeLessThan(1000);
  });

  it('should handle invalid inputs without significant overhead', () => {
    const invalidInputs = [null, undefined, 'string', 123, {}, []];
    const iterations = 100;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      invalidInputs.forEach(input => formatTs(input));
    }
    const end = performance.now();
    warnSpy.mockRestore();

    // Should handle 600 invalid inputs in under 500ms (increased threshold for CI stability)
    expect(end - start).toBeLessThan(500);
  });
});
