import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase modules
vi.mock("../../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "admin-1" } },
}));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockRunTransaction = vi.fn();
const mockDoc = vi.fn((_db, coll, id) => ({ path: `${coll}/${id}`, id }));

vi.mock("firebase/firestore", () => ({
  doc: (a: any, b?: any, c?: any) => mockDoc(a, b, c),
  getDoc: (ref: any) => mockGetDoc(ref),
  getDocs: (q: any) => mockGetDocs(q),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  query: (q: any, ...constraints: any[]) => ({ q, constraints }),
  where: (field: string, op: any, val: any) => ({ field, op, val }),
  collection: (_db: any, name: string) => ({ name }),
  serverTimestamp: vi.fn(() => ({ __ts: true })),
  deleteField: vi.fn(() => ({ __delete: true })),
  runTransaction: (db: any, cb: any) => mockRunTransaction(db, cb),
}));

vi.mock("../coinService", () => ({
  generateUniqueReferralCode: vi.fn(() => "PNABC123"),
  isValidReferralCode: vi.fn(() => true),
  normalizeReferralCode: vi.fn((c) => c),
}));

vi.mock("../reviewService", () => ({
  recalculateProRating: vi.fn(),
}));

import { updateUserProfile } from "../userService";

describe("userService - updateUserProfile bugfixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw error if admin tries to change their own role or disabled status", async () => {
    const targetUid = "admin-1";
    await expect(updateUserProfile(targetUid, { role: "user" })).rejects.toThrow("Cannot modify own role or disabled status");
    await expect(updateUserProfile(targetUid, { disabled: true })).rejects.toThrow("Cannot modify own role or disabled status");
  });

  it("should block demotion/disabling of the last admin transactionally", async () => {
    const targetUid = "admin-2";
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ role: "admin", disabled: false }),
    });

    mockRunTransaction.mockImplementation(async (_db, cb) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref) => {
          if (ref.path === "appSettings/adminStats") {
            return {
              exists: () => true,
              data: () => ({ activeAdminUids: ["admin-1", "admin-2"] }),
            };
          }
          return { exists: () => false };
        }),
        update: vi.fn(),
        set: vi.fn(),
      };
      await cb(mockTx);
    });

    await expect(updateUserProfile(targetUid, { role: "user" })).resolves.not.toThrow();

    mockRunTransaction.mockImplementation(async (_db, cb) => {
      const mockTx = {
        get: vi.fn().mockImplementation(async (ref) => {
          if (ref.path === "appSettings/adminStats") {
            return {
              exists: () => true,
              data: () => ({ activeAdminUids: ["admin-2"] }),
            };
          }
          return { exists: () => false };
        }),
        update: vi.fn(),
        set: vi.fn(),
      };
      await cb(mockTx);
    });

    await expect(updateUserProfile(targetUid, { role: "user" })).rejects.toThrow("At least one active admin must remain");
  });
});
