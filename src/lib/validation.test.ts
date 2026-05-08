import { describe, expect, it } from "vitest";
import {
  ActivitySchema,
  AdminServiceUpdateSchema,
  asArray,
  asBoolean,
  asNumber,
  asString,
  AuditLogSchema,
  BookingSchema,
  DisputeSchema,
  PayoutRequestSchema,
  ProfileUpdateSchema,
  ReferralRewardSchema,
  ReviewSchema,
  ServiceSchema,
  validateAuditEntry,
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

  it("validates booking schema correctly", () => {
    const validBooking = {
      clientId: "client-1",
      proId: "pro-1",
      status: "pending" as const,
    };
    expect(() => BookingSchema.parse(validBooking)).not.toThrow();

    expect(() => BookingSchema.parse({ ...validBooking, amount: -1 })).toThrow();
    expect(() => BookingSchema.parse({ ...validBooking, notes: "x".repeat(501) })).toThrow();
  });

  it("validates profile update schema correctly", () => {
    const validProfile = {
      displayName: "John Doe",
      phoneNumber: "+919876543210",
    };
    expect(() => ProfileUpdateSchema.parse(validProfile)).not.toThrow();

    expect(() => ProfileUpdateSchema.parse({ ...validProfile, displayName: "A" })).toThrow();
    expect(() => ProfileUpdateSchema.parse({ ...validProfile, phoneNumber: "123" })).toThrow();
  });

  it("validates payout request schema correctly", () => {
    const validPayout = {
      uid: "user-1",
      displayName: "User One",
      coinsRedeemed: 100,
      amountRs: 100,
      upiId: "user@upi",
    };
    expect(() => PayoutRequestSchema.parse(validPayout)).not.toThrow();

    expect(() => PayoutRequestSchema.parse({ ...validPayout, coinsRedeemed: -1 })).toThrow();
    expect(() => PayoutRequestSchema.parse({ ...validPayout, upiId: "invalid-upi" })).toThrow();
  });

  it("validates review schema correctly", () => {
    const validReview = {
      bookingId: "booking-1",
      rating: 5,
      reviewedById: "user-1",
    };
    expect(() => ReviewSchema.parse(validReview)).not.toThrow();

    expect(() => ReviewSchema.parse({ ...validReview, rating: 0 })).toThrow();
    expect(() => ReviewSchema.parse({ ...validReview, rating: 6 })).toThrow();
  });

  it("validates referral reward schema correctly", () => {
    const validReferral = {
      referrerId: "referrer-1",
      referralCode: "CODE123",
      referredUid: "referred-1",
      bookingId: "booking-1",
    };
    expect(() => ReferralRewardSchema.parse(validReferral)).not.toThrow();

    expect(() => ReferralRewardSchema.parse({ ...validReferral, referrerId: "" })).toThrow();
  });

  it("validates dispute schema correctly", () => {
    const validDispute = {
      raisedByUid: "user-1",
      bookingId: "booking-1",
      reason: "This is a valid reason for dispute",
    };
    expect(() => DisputeSchema.parse(validDispute)).not.toThrow();

    expect(() => DisputeSchema.parse({ ...validDispute, reason: "Short" })).toThrow();
  });

  it("validates service schema correctly", () => {
    const validService = {
      name: "Plumbing",
      category: "Home Services",
      hourlyRate: 500,
    };
    expect(() => ServiceSchema.parse(validService)).not.toThrow();

    expect(() => ServiceSchema.parse({ ...validService, name: "AB" })).toThrow();
    expect(() => ServiceSchema.parse({ ...validService, hourlyRate: -100 })).toThrow();
  });

  it("validates admin service update schema correctly", () => {
    const validUpdate = {
      title: "Updated Service",
      price: 1000,
    };
    expect(() => AdminServiceUpdateSchema.parse(validUpdate)).not.toThrow();

    expect(() => AdminServiceUpdateSchema.parse({ ...validUpdate, title: "AB" })).toThrow();
  });

  it("validates activity schema correctly", () => {
    const validActivity = {
      uid: "user-1",
      type: "login",
      description: "User logged in",
    };
    expect(() => ActivitySchema.parse(validActivity)).not.toThrow();

    expect(() => ActivitySchema.parse({ ...validActivity, description: "x".repeat(501) })).toThrow();
  });

  it("validates audit log schema correctly", () => {
    const validAudit = {
      action: "user.login",
      adminId: "admin-1",
      adminName: "Admin User",
      details: "User logged in",
    };
    expect(() => AuditLogSchema.parse(validAudit)).not.toThrow();

    expect(() => AuditLogSchema.parse({ ...validAudit, action: "Invalid Action" })).toThrow();
  });

  it("validateInput throws formatted error on invalid data", () => {
    expect(() => validateInput(ProfileUpdateSchema, { displayName: "A", phoneNumber: "+919876543210" }))
      .toThrowError(/Validation error/);
  });

  it("validateAuditEntry validates audit logs", () => {
    const validAudit = {
      action: "user.create",
      adminId: "admin-1",
      adminName: "Admin",
      details: "Created user",
    };
    expect(() => validateAuditEntry(validAudit)).not.toThrow();

    expect(() => validateAuditEntry({ ...validAudit, action: "INVALID" })).toThrow();
  });

  describe("runtime type-safe getters", () => {
    it("asString returns string or fallback", () => {
      expect(asString("hello")).toBe("hello");
      expect(asString(123, "fallback")).toBe("fallback");
      expect(asString(null, "fallback")).toBe("fallback");
    });

    it("asNumber returns number or fallback", () => {
      expect(asNumber(123)).toBe(123);
      expect(asNumber("123")).toBe(123);
      expect(asNumber("abc", 0)).toBe(0);
      expect(asNumber(NaN, 0)).toBe(0);
    });

    it("asArray returns array or fallback", () => {
      expect(asArray([1, 2])).toEqual([1, 2]);
      expect(asArray("not an array", [])).toEqual([]);
      expect(asArray(null, [1])).toEqual([1]);
    });

    it("asBoolean returns boolean or fallback", () => {
      expect(asBoolean(true)).toBe(true);
      expect(asBoolean(false)).toBe(false);
      expect(asBoolean(1, false)).toBe(false);
      expect(asBoolean("true", false)).toBe(false);
    });
  });
});
