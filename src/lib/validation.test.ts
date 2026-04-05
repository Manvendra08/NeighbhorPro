import { describe, expect, it } from "vitest";
import {
  AuditLogSchema,
  BookingSchema,
  ProfileUpdateSchema,
  ServiceSchema,
  validateInput,
} from "./validation";

describe("validation", () => {
  it("accepts a valid profile update payload", () => {
    const parsed = ProfileUpdateSchema.parse({
      displayName: "Aarav Mehta",
      phoneNumber: "+919876543210",
      bio: "Trusted neighborhood electrician",
    });

    expect(parsed.displayName).toBe("Aarav Mehta");
  });

  it("rejects invalid Indian phone numbers", () => {
    expect(() =>
      ProfileUpdateSchema.parse({
        displayName: "A",
        phoneNumber: "9876543210",
      }),
    ).toThrow();
  });

  it("surfaces contextual validation errors with field paths", () => {
    expect(() =>
      validateInput(
        BookingSchema,
        { proId: "", status: "pending", notes: "x".repeat(501) },
        "booking.create",
      ),
    ).toThrowError(/Validation error \(booking\.create\): clientId: Invalid input: expected string, received undefined; proId: Professional ID required; notes: Notes must be 500 characters or less/);
  });

  it("guards audit log action formats and service rates", () => {
    expect(() =>
      AuditLogSchema.parse({
        action: "User.Role",
        adminId: "admin-1",
        adminName: "Admin",
        details: "Bad action",
      }),
    ).toThrow();

    expect(() =>
      ServiceSchema.parse({
        name: "Tutor",
        category: "Education",
        hourlyRate: 0,
      }),
    ).toThrow();
  });
});
