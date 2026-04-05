import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoyaltyStreak } from "../types";

const cashbackQueue = vi.hoisted(() => vi.fn());
const proBonusQueue = vi.hoisted(() => vi.fn());

const firestoreState = vi.hoisted(() => {
  class MockTimestamp {
    seconds: number;

    constructor(seconds = Date.now() / 1000) {
      this.seconds = Math.floor(seconds);
    }

    toDate() {
      return new Date(this.seconds * 1000);
    }
  }

  const store = new Map<string, Record<string, unknown>>();
  const timestampToken = { __serverTimestamp: true };

  const clone = <T,>(value: T): T => structuredClone(value);
  const hydrate = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(hydrate);
    if (value && typeof value === "object") {
      if ((value as { __serverTimestamp?: boolean }).__serverTimestamp) {
        return new MockTimestamp();
      }

      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, hydrate(nested)]),
      );
    }

    return value;
  };

  return {
    MockTimestamp,
    timestampToken,
    store,
    reset() {
      store.clear();
    },
    seed(path: string, data: Record<string, unknown>) {
      store.set(path, clone(data));
    },
    read(path: string) {
      const value = store.get(path);
      return value ? clone(value) : undefined;
    },
    write(path: string, data: Record<string, unknown>, merge = false) {
      const next = hydrate(data) as Record<string, unknown>;
      const current = merge ? store.get(path) ?? {} : {};
      store.set(path, { ...current, ...next });
    },
  };
});

vi.mock("firebase/firestore", () => {
  const toPath = (parts: unknown[]) =>
    parts
      .filter(part => !(part && typeof part === "object" && !("path" in (part as Record<string, unknown>))))
      .map(part => typeof part === "string" ? part : String((part as { path: string }).path))
      .join("/");

  const docPath = (parts: unknown[]) => {
    if (parts[0] && typeof parts[0] === "object" && "path" in (parts[0] as Record<string, unknown>)) {
      return [String((parts[0] as { path: string }).path), ...parts.slice(1).map(part => String(part))].join("/");
    }

    return toPath(parts.slice(1)) || toPath(parts);
  };

  const makeSnapshot = (path: string) => {
    const data = firestoreState.read(path);
    return {
      id: path.split("/").slice(-1)[0] ?? "",
      exists: () => data !== undefined,
      data: () => data,
    };
  };

  class MockTransaction {
    async get(ref: { path: string }) {
      return makeSnapshot(ref.path);
    }

    set(ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) {
      firestoreState.write(ref.path, data, options?.merge);
    }

    update(ref: { path: string }, data: Record<string, unknown>) {
      firestoreState.write(ref.path, data, true);
    }
  }

  return {
    Timestamp: firestoreState.MockTimestamp,
    doc: (...parts: unknown[]) => ({ path: docPath(parts) }),
    getDoc: async (ref: { path: string }) => makeSnapshot(ref.path),
    runTransaction: async (_db: unknown, callback: (tx: MockTransaction) => Promise<unknown>) => callback(new MockTransaction()),
    serverTimestamp: () => firestoreState.timestampToken,
  };
});

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("./coinService", () => ({
  queueLoyaltyCashbackCredit: cashbackQueue,
  queueProLoyaltyBonusCredit: proBonusQueue,
}));

import {
  buildRecurringRebookQuery,
  calculateLoyaltyRewards,
  getLoyaltyPreview,
  getLoyaltyTierLabel,
  getLoyaltyTierRule,
  getLoyaltyTierForCount,
  getLoyaltyTierWeight,
  getNextLoyaltyTier,
  getNextRecurringDate,
  processCompletedBookingLoyalty,
  sortProfessionalsByLoyalty,
} from "./loyaltyService";

describe("loyaltyService", () => {
  beforeEach(() => {
    firestoreState.reset();
    cashbackQueue.mockReset();
    proBonusQueue.mockReset();
  });

  it("calculates tiers at the configured thresholds", () => {
    expect(getLoyaltyTierForCount(9)).toBe("none");
    expect(getLoyaltyTierForCount(10)).toBe("bronze");
    expect(getLoyaltyTierForCount(15)).toBe("silver");
    expect(getLoyaltyTierForCount(30)).toBe("gold");
    expect(getLoyaltyTierForCount(50)).toBe("diamond");
  });

  it("returns tier metadata helpers for labels, weights and next-tier progression", () => {
    expect(getLoyaltyTierWeight("gold")).toBeGreaterThan(getLoyaltyTierWeight("silver"));
    expect(getLoyaltyTierWeight(undefined)).toBe(getLoyaltyTierWeight("none"));
    expect(getLoyaltyTierLabel("diamond")).toBe("Diamond");
    expect(getLoyaltyTierLabel("none")).toBe("New");
    expect(getNextLoyaltyTier("none")).toBe("bronze");
    expect(getNextLoyaltyTier("diamond")).toBeNull();
    expect(getLoyaltyTierRule("silver")?.threshold).toBe(15);
    expect(getLoyaltyTierRule("none")).toBeNull();
  });

  it("scales rewards down to the available reward budget", () => {
    const rewards = calculateLoyaltyRewards(50, 2000, 0.02);

    expect(rewards.rewardBudgetCoins).toBe(40);
    expect(rewards.totalRewardCoins).toBe(40);
    expect(rewards.cashbackCoins).toBeGreaterThan(rewards.proBonusCoins);
    expect(rewards.cashbackCoins + rewards.proBonusCoins).toBe(rewards.rewardBudgetCoins);
  });

  it("returns preview based on existing streak and computes next booking rewards", async () => {
    firestoreState.seed("loyaltyStreaks/client-1_pro-1", {
      currentStreak: 14,
      tier: "bronze",
      highestTier: "bronze",
      lastBookingDate: "2026-04-01",
      cadence: "weekly",
      createdAt: new firestoreState.MockTimestamp(),
    });

    const preview = await getLoyaltyPreview("client-1", "pro-1", 300);
    expect(preview.currentStreak).toBe(14);
    expect(preview.currentTier).toBe("bronze");
    expect(preview.streakCount).toBe(15);
    expect(preview.tier).toBe("silver");
  });

  it("builds recurring rebook query and next recurring date", () => {
    expect(getNextRecurringDate("2026-04-01")).toBe("2026-04-08");
    const queryString = buildRecurringRebookQuery({
      id: "booking-123",
      serviceId: "svc-10",
      timeSlot: "10:00",
      date: "2026-04-01",
    });
    expect(queryString).toContain("serviceId=svc-10");
    expect(queryString).toContain("timeSlot=10%3A00");
    expect(queryString).toContain("date=2026-04-08");
    expect(queryString).toContain("rebook=1");
    expect(queryString).toContain("bookingId=booking-123");
  });

  it("sorts professionals by loyalty tier, then rating, then review count, then name", () => {
    const sorted = sortProfessionalsByLoyalty([
      { displayName: "Zed", highestLoyaltyTier: "silver", rating: 4.2, reviewCount: 12 },
      { displayName: "Amy", highestLoyaltyTier: "gold", rating: 3.9, reviewCount: 3 },
      { displayName: "Bob", highestLoyaltyTier: "gold", rating: 4.6, reviewCount: 10 },
      { displayName: "Carl", highestLoyaltyTier: "gold", rating: 4.6, reviewCount: 8 },
    ]);

    expect(sorted.map((item) => item.displayName)).toEqual(["Bob", "Carl", "Amy", "Zed"]);
  });

  it("continues a weekly streak and queues loyalty rewards", async () => {
    firestoreState.seed("bookings/booking-1", { date: "2026-04-08" });
    firestoreState.seed("users/pro-1", { highestLoyaltyTier: "bronze" });
    firestoreState.seed("loyaltyStreaks/client-1_pro-1", {
      currentStreak: 14,
      longestStreak: 14,
      tier: "bronze",
      highestTier: "bronze",
      cadence: "weekly",
      lastBookingDate: "2026-04-01",
      streakStartDate: "2026-01-01",
      totalCashbackEarned: 0,
      totalProBonusEarned: 0,
      createdAt: new firestoreState.MockTimestamp(),
    } satisfies Partial<LoyaltyStreak>);

    await processCompletedBookingLoyalty({
      bookingId: "booking-1",
      clientId: "client-1",
      proId: "pro-1",
      amount: 200,
      serviceName: "Cleaning",
      bookingDate: "2026-04-08",
    });

    expect(firestoreState.read("loyaltyStreaks/client-1_pro-1")).toMatchObject({
      currentStreak: 15,
      longestStreak: 15,
      tier: "silver",
      highestTier: "silver",
      totalCashbackEarned: 10,
      totalProBonusEarned: 4,
      lastCompletedBookingId: "booking-1",
    });
    expect(firestoreState.read("bookings/booking-1")).toMatchObject({
      streakCount: 15,
      loyaltyTier: "silver",
      loyaltyCashback: 10,
      proBonus: 4,
    });
    expect(firestoreState.read("users/pro-1")).toMatchObject({ highestLoyaltyTier: "silver" });
    expect(cashbackQueue).toHaveBeenCalledWith(expect.any(Object), "client-1", "booking-1", 10, "Cleaning");
    expect(proBonusQueue).toHaveBeenCalledWith(expect.any(Object), "pro-1", "booking-1", 4, "Cleaning");
  });

  it("resets a broken streak and preserves the highest tier achieved", async () => {
    firestoreState.seed("bookings/booking-2", { date: "2026-04-30" });
    firestoreState.seed("users/pro-1", { highestLoyaltyTier: "silver" });
    firestoreState.seed("loyaltyStreaks/client-1_pro-1", {
      currentStreak: 15,
      longestStreak: 15,
      tier: "silver",
      highestTier: "silver",
      cadence: "weekly",
      lastBookingDate: "2026-04-01",
      streakStartDate: "2026-01-01",
      totalCashbackEarned: 10,
      totalProBonusEarned: 4,
      createdAt: new firestoreState.MockTimestamp(),
    } satisfies Partial<LoyaltyStreak>);

    await processCompletedBookingLoyalty({
      bookingId: "booking-2",
      clientId: "client-1",
      proId: "pro-1",
      amount: 100,
      bookingDate: "2026-04-30",
    });

    expect(firestoreState.read("loyaltyStreaks/client-1_pro-1")).toMatchObject({
      currentStreak: 1,
      tier: "none",
      highestTier: "silver",
      cadence: "monthly",
      streakStartDate: "2026-04-30",
    });
    expect(cashbackQueue).not.toHaveBeenCalled();
    expect(proBonusQueue).not.toHaveBeenCalled();
  });
});
