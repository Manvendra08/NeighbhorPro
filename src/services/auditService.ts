import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Structured audit event metadata.
 * Actions must include required fields for full traceability.
 */
export interface AuditMetadata {
  action: string; // e.g., "user.role_change", "user.disable", "verification.reviewed"
  adminId: string; // UID of the admin performing the action
  adminName: string; // Display name of the admin
  details: string; // Free-form summary of the action
  targetId?: string | null; // UID of the affected user
  metadata?: Record<string, unknown>; // Custom structured data
}

/**
 * Audit event schema for validation.
 * Used to ensure required fields are present before logging.
 */
export const AUDIT_SCHEMA = {
  role_change: {
    required: ["action", "adminId", "adminName", "details", "targetId"],
    metadata_fields: ["oldRole", "newRole", "targetName"],
  },
  verification_reviewed: {
    required: ["action", "adminId", "adminName", "details", "targetId"],
    metadata_fields: ["verificationStatus", "reviewNote", "targetName"],
  },
  user_disable: {
    required: ["action", "adminId", "adminName", "details", "targetId"],
    metadata_fields: ["disabled", "targetName"],
  },
  user_delete: {
    required: ["action", "adminId", "adminName", "details", "targetId"],
    metadata_fields: ["targetName", "userEmail"],
  },
};

/**
 * Validates that audit metadata contains all required fields.
 * Throws error if validation fails.
 */
function validateAuditMetadata(metadata: AuditMetadata): void {
  if (!metadata.action || metadata.action.trim() === "") {
    throw new Error("Audit action is required");
  }
  if (!metadata.adminId || metadata.adminId.trim() === "") {
    throw new Error("Admin ID is required");
  }
  if (!metadata.adminName || metadata.adminName.trim() === "") {
    throw new Error("Admin name is required");
  }
  if (!metadata.details || metadata.details.trim() === "") {
    throw new Error("Audit details are required");
  }

  // For sensitive actions, ensure admin is not acting on themselves
  const sensitiveActions = [
    "user.role_change",
    "user.disable",
    "user.delete",
  ];
  if (
    sensitiveActions.includes(metadata.action) &&
    metadata.targetId &&
    metadata.adminId === metadata.targetId
  ) {
    throw new Error(
      `Cannot perform ${metadata.action} on yourself`
    );
  }
}

/**
 * Captures an audit event with full traceability metadata.
 * Validates metadata before logging to Firestore.
 *
 * @param metadata - Structured audit event data
 * @returns Document ID of the created audit log entry
 * @throws Error if metadata validation fails or database write fails
 */
export async function captureAuditEvent(
  metadata: AuditMetadata
): Promise<string> {
  // Validate metadata
  validateAuditMetadata(metadata);

  // Build audit log entry
  const auditEntry = {
    action: metadata.action,
    adminId: metadata.adminId,
    adminName: metadata.adminName,
    details: metadata.details,
    targetId: metadata.targetId || null,
    metadata: metadata.metadata || {},
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, "auditLogs"), auditEntry);
    return docRef.id;
  } catch (error) {
    console.error("Failed to capture audit event:", error);
    throw new Error(
      `Audit logging failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Returns audit schema for UI validation and message display.
 */
export function getAuditSchema(): Record<string, unknown> {
  return AUDIT_SCHEMA;
}

/**
 * Helper to create role change metadata consistently.
 */
export function createRoleChangeMetadata(
  oldRole: string,
  newRole: string,
  targetName: string,
  targetId: string
): Record<string, unknown> {
  return {
    oldRole,
    newRole,
    targetName,
    targetId,
  };
}

/**
 * Helper to create verification metadata consistently.
 */
export function createVerificationMetadata(
  verificationStatus: "verified" | "none" | "pending",
  reviewNote: string | null,
  targetName: string,
  targetId: string
): Record<string, unknown> {
  return {
    verificationStatus,
    reviewNote: reviewNote || null,
    targetName,
    targetId,
  };
}
