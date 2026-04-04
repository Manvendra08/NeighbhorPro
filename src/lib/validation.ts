/**
 * Input validation schemas using Zod.
 * All forms and API inputs validated against these schemas before Firestore writes.
 */
import { z } from "zod";

// ── Booking Schema ────────────────────────────────────────────────────────────
export const BookingSchema = z.object({
  clientId: z.string().min(1, "Client ID required"),
  proId: z.string().min(1, "Professional ID required"),
  serviceId: z.string().optional(),
  serviceName: z.string().optional(),
  serviceCategory: z.string().optional(),
  date: z.string().optional(),
  timeSlot: z.string().optional(),
  notes: z.string().max(500, "Notes must be 500 characters or less").optional(),
  amount: z.number().positive("Amount must be positive").optional(),
  isPaid: z.boolean().optional(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled", "reviewed"]),
  escrowCoins: z.number().nonnegative().optional(),
});

export type BookingInput = z.infer<typeof BookingSchema>;

// ── Profile Update Schema ─────────────────────────────────────────────────────
export const ProfileUpdateSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters").max(100),
  phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/, "Invalid Indian phone number. Format: +91XXXXXXXXXX"),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  society: z.string().max(100).optional(),
  role: z.enum(["resident", "professional", "both"]).optional(),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;

// ── Payout Request Schema ─────────────────────────────────────────────────────
export const PayoutRequestSchema = z.object({
  uid: z.string().min(1, "User ID required"),
  displayName: z.string().min(1, "Display name required"),
  coinsRedeemed: z.number().positive("Coins must be positive"),
  amountRs: z.number().positive("Amount must be positive"),
  upiId: z.string().regex(/^[\w.-]+@[\w-]+$/, "Invalid UPI ID format"),
});

export type PayoutRequestInput = z.infer<typeof PayoutRequestSchema>;

// ── Review Schema ─────────────────────────────────────────────────────────────
export const ReviewSchema = z.object({
  bookingId: z.string().min(1, "Booking ID required"),
  rating: z.number().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  comment: z.string().max(500, "Comment must be 500 characters or less").optional(),
  reviewedById: z.string().min(1, "Reviewer ID required"),
});

export type ReviewInput = z.infer<typeof ReviewSchema>;

// ── Referral Reward Schema ────────────────────────────────────────────────────
export const ReferralRewardSchema = z.object({
  referrerId: z.string().min(1, "Referrer ID required"),
  referralCode: z.string().min(1, "Referral code required"),
  referredUid: z.string().min(1, "Referred user ID required"),
  bookingId: z.string().min(1, "Booking ID required"),
});

export type ReferralRewardInput = z.infer<typeof ReferralRewardSchema>;

// ── Dispute Schema ────────────────────────────────────────────────────────────
export const DisputeSchema = z.object({
  raisedByUid: z.string().min(1, "User ID required"),
  bookingId: z.string().min(1, "Booking ID required"),
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500),
  description: z.string().max(1000, "Description must be 1000 characters or less").optional(),
  status: z.enum(["raised", "in_progress", "resolved", "closed"]).default("raised"),
});

export type DisputeInput = z.infer<typeof DisputeSchema>;

// ── Service Schema ────────────────────────────────────────────────────────────
export const ServiceSchema = z.object({
  name: z.string().min(3, "Service name must be at least 3 characters").max(100),
  category: z.string().min(1, "Category required"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  hourlyRate: z.number().positive("Hourly rate must be positive"),
});

export type ServiceInput = z.infer<typeof ServiceSchema>;

// ── Activity Schema ───────────────────────────────────────────────────────────
export const ActivitySchema = z.object({
  uid: z.string().min(1, "User ID required"),
  type: z.string().min(1, "Activity type required"),
  description: z.string().max(500),
  refId: z.string().optional(),
});

export type ActivityInput = z.infer<typeof ActivitySchema>;

// ── Helper function: Safe validation ──────────────────────────────────────────
/**
 * Validate input against schema and return parsed data or throw ZodError.
 * Use in service layer before Firestore writes.
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = (error as z.ZodError<unknown>).issues
        .map((issue: z.ZodIssue) => `${String(issue.path).replace(/,/g, ".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`Validation error${context ? ` (${context})` : ""}: ${messages}`);
    }
    throw error;
  }
}

// ── Audit Log Schema ──────────────────────────────────────────────────────────
/**
 * Audit log schema for validating admin action records.
 * All audit events must match this schema before persisting.
 */
export const AuditLogSchema = z.object({
  action: z.string()
    .min(3, "Action must be at least 3 characters")
    .max(50, "Action must be 50 characters or less")
    .regex(/^[a-z]+\.[a-z_]+$/, "Action must be lowercase with dots (e.g., user.role_change)"),
  adminId: z.string().min(1, "Admin ID required"),
  adminName: z.string().min(1, "Admin name required"),
  details: z.string().min(1, "Details required").max(500, "Details must be 500 characters or less"),
  targetId: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional(),
  timestamp: z.any().optional(), // Firebase serverTimestamp
  createdAt: z.any().optional(), // Firebase serverTimestamp
});

export type AuditLogInput = z.infer<typeof AuditLogSchema>;

/**
 * Validate audit log entry against schema.
 */
export function validateAuditEntry(data: unknown): AuditLogInput {
  return validateInput(AuditLogSchema, data, "audit log");
}
