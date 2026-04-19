import { describe, expect, it } from "vitest";
import {
  BOOKING_BRIEF_MAX_CHARS,
  getPaymentStatusLabel,
  isBookingBriefValid,
} from "./booking";

describe("booking utils", () => {
  it("enforces 500-char hard stop for brief", () => {
    expect(isBookingBriefValid("x".repeat(BOOKING_BRIEF_MAX_CHARS))).toBe(true);
    expect(isBookingBriefValid("x".repeat(BOOKING_BRIEF_MAX_CHARS + 1))).toBe(false);
  });

  it("shows no payment required for free bookings", () => {
    expect(getPaymentStatusLabel(0, 0, "pending")).toBe("No payment required");
  });
});
