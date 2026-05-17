import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocs } from "firebase/firestore";

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
    keys(prefix: string) {
      return [...store.keys()].filter(key => key.startsWith(prefix));
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

  const collectionPath = (parts: unknown[]) => {
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
    Transaction: MockTransaction,
    collection: (...parts: unknown[]) => ({ path: collectionPath(parts) }),
    collectionGroup: vi.fn(),
    count: vi.fn(),
    doc: (...parts: unknown[]) => ({ path: docPath(parts) }),
    getAggregateFromServer: vi.fn(async () => ({ data: () => ({}) })),
    getDoc: async (ref: { path: string }) => makeSnapshot(ref.path),
    getDocs: vi.fn(async () => ({ docs: [] })),
    limit: vi.fn(),
    orderBy: vi.fn(),
    query: vi.fn(),
    runTransaction: async (_db: unknown, callback: (tx: MockTransaction) => Promise<unknown>) => callback(new MockTransaction()),
    serverTimestamp: () => firestoreState.timestampToken,
    setDoc: async (ref: { path: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => {
      firestoreState.write(ref.path, data, options?.merge);
    },
    startAfter: vi.fn(),
    sum: vi.fn(),
    updateDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
      firestoreState.write(ref.path, data, true);
    },
    where: vi.fn(),
  };
});

vi.mock("../firebase", () => ({ db: {} }));

import {
  applyReferralCodeAtSignup,
  EARN_RULES,
  generateReferralCode,
  holdEscrow,
  isValidReferralCode,
  releaseEscrow,
  requestPayout,
  topUpCoins,
} from "./coinService";

describe("coinService", () => {
  beforeEach(() => {
    firestoreState.reset();
    vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as unknown as Awaited<ReturnType<typeof getDocs>>);
  });

  it("treats topUpCoins as idempotent per payment id", async () => {
    firestoreState.seed("users/user-1", { coinBalance: 100 });

    await topUpCoins("user-1", 499, 75, "Starter", "pay_123");
    await topUpCoins("user-1", 499, 75, "Starter", "pay_123");

    expect(firestoreState.read("users/user-1")?.coinBalance).toBe(175);
    expect(firestoreState.read("coinPurchases/pay_123")).toMatchObject({
      uid: "user-1",
      amountPaid: 499,
      coinsGranted: 75,
      paymentId: "pay_123",
    });
    expect(firestoreState.keys("coinLedger/user-1/entries")).toEqual(["coinLedger/user-1/entries/pay_123_topup"]);
  });

  it("holds escrow once for the same booking", async () => {
    firestoreState.seed("users/client-1", { coinBalance: 120 });
    firestoreState.seed("bookings/booking-1", { escrowCoins: 0, escrowStatus: "none" });

    const first = await holdEscrow("client-1", "booking-1", 60, "Cleaning");
    const second = await holdEscrow("client-1", "booking-1", 60, "Cleaning");

    expect(first).toEqual({ success: true });
    expect(second).toEqual({ success: true });
    expect(firestoreState.read("users/client-1")?.coinBalance).toBe(60);
    expect(firestoreState.read("bookings/booking-1")).toMatchObject({
      escrowCoins: 60,
      coinsPaid: true,
      escrowStatus: "held",
    });
    expect(firestoreState.keys("coinLedger/client-1/entries")).toEqual([
      "coinLedger/client-1/entries/booking-1_hold_client-1",
    ]);
  });

  it("returns an insufficient balance reason when escrow cannot be held", async () => {
    firestoreState.seed("users/client-1", { coinBalance: 20 });
    firestoreState.seed("bookings/booking-1", { escrowCoins: 0, escrowStatus: "none" });

    await expect(holdEscrow("client-1", "booking-1", 60, "Cleaning")).resolves.toEqual({
      success: false,
      reason: "INSUFFICIENT_BALANCE",
    });
  });

  it("releases escrow once and credits only the pro earnings", async () => {
    firestoreState.seed("users/pro-1", { coinBalance: 10 });
    firestoreState.seed("bookings/booking-1", { escrowCoins: 100, escrowStatus: "held", status: "confirmed" });

    const first = await releaseEscrow("pro-1", "booking-1", "Cleaning");
    const second = await releaseEscrow("pro-1", "booking-1", "Cleaning");

    expect(first).toEqual({ success: true });
    expect(second).toEqual({ success: true });
    expect(firestoreState.read("users/pro-1")?.coinBalance).toBe(100);
    expect(firestoreState.read("bookings/booking-1")).toMatchObject({
      status: "completed",
      escrowStatus: "released",
      platformFee: 10,
      proEarning: 90,
      paidInCoins: 100,
    });
    expect(firestoreState.keys("coinLedger/pro-1/entries")).toEqual([
      "coinLedger/pro-1/entries/booking-1_release_pro-1",
    ]);
  });

  it("blocks payout request when a pending payout already exists", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      empty: false,
      docs: [{ id: "pending_1", data: () => ({ uid: "user-1", status: "pending", upiId: "test@upi" }) }],
    } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await requestPayout("user-1", "User One", 300, "user@upi");

    expect(result.success).toBe(false);
    expect(result.reason).toContain("already pending");
  });

  it("creates payout request when no pending payout exists", async () => {
    // Seed both coinBalance AND cashableBalance since requestPayout checks cashableBalance
    // Only coins from top-ups, booking earnings, and refunds are cashable (withdrawable)
    firestoreState.seed("users/user-1", { coinBalance: 1000, cashableBalance: 1000 });
    vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as unknown as Awaited<ReturnType<typeof getDocs>>);

    const result = await requestPayout("user-1", "User One", 300, "user@upi");

    expect(result).toEqual({ success: true });
    expect(firestoreState.read("users/user-1")?.coinBalance).toBe(700);
    expect(firestoreState.read("users/user-1")?.cashableBalance).toBe(700);
  });

  it("generates referral code matching required format", () => {
    const code = generateReferralCode({ uid: "alphaUser123456" });
    expect(isValidReferralCode(code)).toBe(true);
  });

  it("credits signup referral coins to referrer when valid code used", async () => {
    const referralReward = EARN_RULES.earn_referral.coins;
    firestoreState.seed("referralCodes/PNABC123", { uid: "referrer-1", code: "PNABC123" });
    firestoreState.seed("users/referrer-1", { coinBalance: 50 });
    firestoreState.seed("users/new-user-1", { coinBalance: 25 });

    const result = await applyReferralCodeAtSignup("new-user-1", "PNABC123");

    expect(result).toEqual({ success: true });
    expect(firestoreState.read("users/new-user-1")?.coinBalance).toBe(25);
        expect(firestoreState.read("users/referrer-1")?.coinBalance).toBe(50 + referralReward);
    expect(firestoreState.read("referrals/new-user-1")).toMatchObject({
      newUserUid: "new-user-1",
      referrerUid: "referrer-1",
      code: "PNABC123",
      status: "rewarded_signup",
      rewardMode: "split_referrer_signup_newuser_booking",
      rewardCoins: referralReward,
      rewardToUid: "referrer-1",
    });
    expect(firestoreState.read("coinLedger/referrer-1/entries/new-user-1_signup_referral_referrer")).toMatchObject({
      uid: "referrer-1",
      type: "earn_referral",
      amount: referralReward,
      balanceAfter: 50 + referralReward,
      refId: "new-user-1",
    });
  });
});
