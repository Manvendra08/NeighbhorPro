import { beforeEach, describe, expect, it, vi } from "vitest";

const createOrderMock = vi.fn();

vi.mock("../firebase", () => ({
  functionsClient: {},
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(() => createOrderMock),
}));

vi.mock("./coinService", () => ({
  COIN_PACKS: [
    { label: "Starter", priceRs: 200, coins: 200, bonus: 20 },
  ],
}));

import { initiateTopUp } from "./razorpayService";

describe("razorpayService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_ENABLE_RAZORPAY_TOPUP", "true");
    createOrderMock.mockResolvedValue({
      data: {
        orderId: "order_123",
        amount: 20000,
        currency: "INR",
        keyId: "rzp_test_key",
      },
    });
  });

  it("fails when server order creation fails", async () => {
    createOrderMock.mockRejectedValue(new Error("unauthenticated"));
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

  it("fails closed when topups are disabled", async () => {
    vi.stubEnv("VITE_ENABLE_RAZORPAY_TOPUP", "false");
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

    expect(onError).toHaveBeenCalledWith(
      "Coin top-ups are currently unavailable on the Firebase Spark plan. Contact support to enable Blaze-backed payments."
    );
    expect(createOrderMock).not.toHaveBeenCalled();
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
    (window as Window & { Razorpay?: unknown }).Razorpay = class {
      private readonly options: { handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void };

      constructor(options: { handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void }) {
        this.options = options;
      }

      open() {
        this.options.handler({
          razorpay_payment_id: "pay_123",
          razorpay_order_id: "order_123",
          razorpay_signature: "signature_123",
        });
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

    expect(createOrderMock).toHaveBeenCalledWith({ packLabel: "Starter" });
    expect(onSuccess).toHaveBeenCalledWith("pay_123");
    expect(onStatusChange).toHaveBeenLastCalledWith("success");
  });
});
