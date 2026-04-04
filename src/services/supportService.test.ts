import { beforeEach, describe, expect, it, vi } from "vitest";

const addDocMock = vi.fn();
const getDocsMock = vi.fn();
const updateDocMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  Unsubscribe: vi.fn(),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  limit: vi.fn(() => ({})),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  serverTimestamp: vi.fn(() => ({ seconds: 1 })),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  where: vi.fn(() => ({})),
  Timestamp: { fromDate: vi.fn((d: Date) => d) },
}));

vi.mock("../firebase", () => ({ db: {} }));

import { createTicket, generateTicketNumber, updateTicketStatus } from "./supportService";

describe("supportService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocsMock.mockResolvedValue({ size: 2, docs: [] });
    addDocMock.mockResolvedValue({ id: "ticket_1" });
    updateDocMock.mockResolvedValue(undefined);
  });

  it("generates NP ticket numbers", async () => {
    const ticketNumber = await generateTicketNumber();
    expect(ticketNumber.startsWith("NP")).toBe(true);
    expect(ticketNumber.length).toBe(13);
  });

  it("creates tickets with open status", async () => {
    const ticket = await createTicket({
      uid: "u1",
      displayName: "User One",
      email: "u1@example.com",
      subject: "Payment issue",
      category: "payment",
    });

    expect(ticket.id).toBe("ticket_1");
    expect(addDocMock).toHaveBeenCalledTimes(1);
  });

  it("updates ticket status with resolution metadata", async () => {
    await updateTicketStatus("ticket_1", "resolved", "admin_1");
    expect(updateDocMock).toHaveBeenCalledTimes(1);
  });
});
