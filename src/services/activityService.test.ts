import { beforeEach, describe, expect, it, vi } from "vitest";

const addDocMock = vi.fn();
const getDocsMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => addDocMock(...args),
  collection: vi.fn(() => ({})),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  limit: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => ({ seconds: 1 })),
  where: vi.fn(() => ({})),
}));

vi.mock("../firebase", () => ({ db: {} }));

import { getUserActivityLogs, logActivity } from "./activityService";

describe("activityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addDocMock.mockResolvedValue({ id: "log_1" });
    getDocsMock.mockResolvedValue({ docs: [] });
  });

  it("rate-limits repeated non-critical events", async () => {
    await logActivity("u1", "message.sent", "sent a message");
    await logActivity("u1", "message.sent", "sent a message");

    expect(addDocMock).toHaveBeenCalledTimes(1);
  });

  it("does not rate-limit critical events", async () => {
    await logActivity("u1", "payment.success", "payment ok");
    await logActivity("u1", "payment.success", "payment ok");

    expect(addDocMock).toHaveBeenCalledTimes(2);
  });

  it("maps user activity logs from firestore", async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [{ id: "a1", data: () => ({ userId: "u1", event: "user.login", details: "ok" }) }],
    });

    const logs = await getUserActivityLogs("u1", 10);
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe("a1");
    expect(logs[0].event).toBe("user.login");
  });
});
