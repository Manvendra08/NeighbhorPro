import { httpsCallable } from "firebase/functions";
import { functionsClient } from "../firebase";
import { COIN_PACKS } from "./coinService";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  order_id: string;
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
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface CreateRazorpayOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export function isRazorpayTopupEnabled(): boolean {
  return String(import.meta.env.VITE_ENABLE_RAZORPAY_TOPUP ?? "").trim().toLowerCase() === "true";
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

  if (!isRazorpayTopupEnabled()) {
    onError("Coin top-ups are currently unavailable on the Firebase Spark plan. Contact support to enable Blaze-backed payments.");
    onStatusChange("failed");
    return;
  }

  void uid;

  const pack = COIN_PACKS.find((p) => p.label === packLabel);
  if (!pack) {
    onError(`Unknown pack: ${packLabel}`);
    onStatusChange("failed");
    return;
  }

  try {
    const createOrder = httpsCallable<{ packLabel: string }, CreateRazorpayOrderResponse>(
      functionsClient,
      "createRazorpayOrder"
    );
    const orderResponse = await createOrder({ packLabel });
    const { orderId, amount, currency, keyId } = orderResponse.data;

    await loadSDK();
    onStatusChange("awaiting_payment");

    await new Promise<void>((resolve) => {
      const rzp = new window.Razorpay({
        key:         keyId,
        order_id:    orderId,
        amount,
        currency,
        name:        "ProNeighbor",
        description: `${pack.label} Coin Pack - ${pack.coins + pack.bonus} NC`,
        image:       "/images/logo.png",
        prefill:     { name: userName, email: userEmail },
        theme:       { color: "#1B6B8A" },

        handler: async (response) => {
          onStatusChange("crediting");
          onSuccess(response.razorpay_payment_id);
          onStatusChange("success");
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


