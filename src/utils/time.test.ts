import { describe, expect, it } from "vitest";
import { formatBookingDateTime } from "./time";

describe("time formatting", () => {
  it("formats booking date and slot to IST-safe Indian date time", () => {
    expect(formatBookingDateTime("2026-04-23", "12:00 PM - 01:00 PM")).toBe("23 Apr 2026, 12:00 PM");
  });

  it("supports 24-hour slot strings and keeps expected output format", () => {
    expect(formatBookingDateTime("2026-04-23", "09:30-10:00")).toBe("23 Apr 2026, 09:30 AM");
  });
});
