/**
 * razorpayService.ts - Spark Plan compatible flow
 *
 * Flow:
 *   1. Load checkout.js from Razorpay CDN
 *   2. Open modal directly with Key ID (public key - safe in browser)
 *   3. On payment success -> credit coins client-side via topUpCoins()
 *
 * No server-side verification in this mode.
 * Use only for pilot / Spark-plan testing.
 *
 * Setup:
 *   Add to .env.local -> VITE_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXX
 */

import { topUpCoins, COIN_PACKS } from "./coinService";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open(): void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
}

export type PaymentStatus =
  | "idle"
  | "awaiting_payment"
  | "crediting"
  | "success"
  | "failed"
  | "dismissed";

function loadSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Could not load Razorpay SDK. Check your internet connection."));
    document.body.appendChild(script);
  });
}

export async function initiateTopUp(params: {
  uid: string;
  packLabel: string;
  userName: string;
  userEmail: string;
  onStatusChange: (s: PaymentStatus) => void;
  onSuccess: (paymentId: string) => void;
  onError: (msg: string) => void;
}): Promise<void> {
  const { uid, packLabel, userName, userEmail, onStatusChange, onSuccess, onError } = params;

  const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID as string;
  if (!keyId) {
    onError("Razorpay key not configured. Add VITE_RAZORPAY_KEY_ID to .env.local");
    onStatusChange("failed");
    return;
  }

  const pack = COIN_PACKS.find((p) => p.label === packLabel);
  if (!pack) {
    onError(`Unknown pack: ${packLabel}`);
    onStatusChange("failed");
    return;
  }

  try {
    await loadSDK();
    onStatusChange("awaiting_payment");

    await new Promise<void>((resolve) => {
      const rzp = new window.Razorpay({
        key:         keyId,
        amount:      pack.priceRs * 100,
        currency:    "INR",
        name:        "ProNeighbour",
        description: `${pack.label} Coin Pack - ${pack.coins + pack.bonus} NC`,
        image:       "/images/logo.png",
        prefill:     { name: userName, email: userEmail },
        theme:       { color: "#1B6B8A" },

        handler: async (response) => {
          onStatusChange("crediting");
          try {
            await topUpCoins(
              uid,
              pack.priceRs,
              pack.coins + pack.bonus,
              pack.label,
              response.razorpay_payment_id
            );
            onSuccess(response.razorpay_payment_id);
            onStatusChange("success");
          } catch {
            onError("Payment received but coin credit failed. Contact support with payment ID: " + response.razorpay_payment_id);
            onStatusChange("failed");
          }
          resolve();
        },

        modal: {
          ondismiss: () => {
            onStatusChange("dismissed");
            resolve();
          },
        },
      });

      rzp.open();
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Payment failed. Try again.";
    onError(msg);
    onStatusChange("failed");
  }
}
