import { beforeEach, describe, expect, it, vi } from "vitest";

const topUpCoinsMock = vi.fn();

vi.mock("./coinService", () => ({
  COIN_PACKS: [
    { label: "Starter", priceRs: 200, coins: 200, bonus: 20 },
  ],
  topUpCoins: (...args: unknown[]) => topUpCoinsMock(...args),
}));

import { initiateTopUp } from "./razorpayService";

describe("razorpayService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    topUpCoinsMock.mockResolvedValue(undefined);
  });

  it("fails when Razorpay key is missing", async () => {
    vi.stubEnv("VITE_RAZORPAY_KEY_ID", "");
    const onStatusChange = vi.fn();
    const onError = vi.fn();

    await initiateTopUp({
      uid: "u1",
      packLabel: "Starter",
      userName: "User",
      userEmail: "u@example.com",
      onStatusChange,
      onSuccess: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenCalledWith("failed");
  });

  it("fails for unknown pack", async () => {
    vi.stubEnv("VITE_RAZORPAY_KEY_ID", "rzp_test_key");
    const onStatusChange = vi.fn();
    const onError = vi.fn();

    await initiateTopUp({
      uid: "u1",
      packLabel: "Unknown",
      userName: "User",
      userEmail: "u@example.com",
      onStatusChange,
      onSuccess: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith("Unknown pack: Unknown");
    expect(onStatusChange).toHaveBeenCalledWith("failed");
  });

  it("completes top-up after payment handler succeeds", async () => {
    vi.stubEnv("VITE_RAZORPAY_KEY_ID", "rzp_test_key");

    (window as Window & { Razorpay?: unknown }).Razorpay = class {
      private readonly options: { handler: (response: { razorpay_payment_id: string }) => void };

      constructor(options: { handler: (response: { razorpay_payment_id: string }) => void }) {
        this.options = options;
      }

      open() {
        this.options.handler({ razorpay_payment_id: "pay_123" });
      }
    };

    const onStatusChange = vi.fn();
    const onSuccess = vi.fn();

    await initiateTopUp({
      uid: "u1",
      packLabel: "Starter",
      userName: "User",
      userEmail: "u@example.com",
      onStatusChange,
      onSuccess,
      onError: vi.fn(),
    });

    expect(topUpCoinsMock).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith("pay_123");
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });
});
