import { describe, expect, it, vi } from "vitest";

vi.mock("../firebase", () => ({ db: {}, auth: { currentUser: { uid: "reporter-1" } } }));
vi.mock("firebase/firestore", () => ({
  Timestamp: class MockTimestamp {
    toDate() {
      return new Date();
    }
  },
  doc: vi.fn((...parts: unknown[]) => ({ path: parts.join("/") })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __ts: true })),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
  getCountFromServer: vi.fn(),
  deleteField: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  arrayUnion: vi.fn(),
  deleteDoc: vi.fn(),
  addDoc: vi.fn(),
}));

import { getDoc, setDoc } from "firebase/firestore";
import { reportProfessional } from "./firestoreService";
import { computeAggregateRating } from "../utils/rating";

describe("firestoreService UX helpers", () => {
  it("does not return zero rating when reviews exist", () => {
    const aggregate = computeAggregateRating(0, 2, [{ rating: 4 }, { rating: 5 }]);
    expect(aggregate.reviewCount).toBe(2);
    expect(aggregate.rating).toBe(4.5);
  });

  it("returns no-reviews state when none exist", () => {
    const aggregate = computeAggregateRating(0, 0, []);
    expect(aggregate).toEqual({ rating: null, reviewCount: 0 });
  });

  it("enforces one profile report per reporter-target pair", async () => {
    vi.mocked(getDoc)
      .mockResolvedValueOnce({ exists: () => false } as never)
      .mockResolvedValueOnce({ exists: () => true } as never);

    const first = await reportProfessional("pro-99", "Spam / Fake Profile", "Fake listing");
    const second = await reportProfessional("pro-99", "Spam / Fake Profile", "Duplicate");

    expect(first).toEqual({ success: true });
    expect(second).toEqual({ success: false, alreadyReported: true });
    expect(setDoc).toHaveBeenCalledTimes(1);
  });
});
