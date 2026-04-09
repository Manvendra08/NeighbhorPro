import { describe, expect, it, vi } from "vitest";

const addDocMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => addDocMock(...args),
  collection: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => ({ seconds: 1 })),
}));

vi.mock("../firebase", () => ({ db: {} }));

import {
  captureAuditEvent,
  createRoleChangeMetadata,
  createVerificationMetadata,
  getAuditSchema,
} from "./auditService";

describe("auditService", () => {
  it("returns schema for UI validation", () => {
    const schema = getAuditSchema() as Record<string, unknown>;
    expect(schema).toHaveProperty("role_change");
    expect(schema).toHaveProperty("verification_reviewed");
  });

  it("builds role and verification metadata consistently", () => {
    expect(createRoleChangeMetadata("resident", "pro", "John", "u1")).toMatchObject({
      oldRole: "resident",
      newRole: "pro",
      targetName: "John",
      targetId: "u1",
    });

    expect(createVerificationMetadata("verified", "ok", "Jane", "u2")).toMatchObject({
      verificationStatus: "verified",
      reviewNote: "ok",
      targetName: "Jane",
      targetId: "u2",
    });
  });

  it("captures audit event with required metadata", async () => {
    addDocMock.mockResolvedValueOnce({ id: "audit_1" });

    const id = await captureAuditEvent({
      action: "verification.reviewed",
      adminId: "admin_1",
      adminName: "Admin",
      details: "Approved document",
      targetId: "user_1",
    });

    expect(id).toBe("audit_1");
    expect(addDocMock).toHaveBeenCalledTimes(1);
  });

  it("rejects self-targeting sensitive actions", async () => {
    await expect(
      captureAuditEvent({
        action: "user.role_change",
        adminId: "admin_1",
        adminName: "Admin",
        details: "Attempted self role change",
        targetId: "admin_1",
      }),
    ).rejects.toThrow("Cannot perform user.role_change on yourself");
  });
});
