/**
 * Firebase Cloud Functions — NeighbourCoins × Razorpay
 *
 * Exports:
 *   createRazorpayOrder  — HTTPS callable: browser calls this to get an order_id
 *   razorpayWebhook      — HTTPS endpoint: Razorpay POSTs here on payment.captured
 *
 * Environment config (set via Firebase Functions config):
 *   firebase functions:secrets:set RAZORPAY_KEY_ID
 *   firebase functions:secrets:set RAZORPAY_KEY_SECRET
 *   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
 */

import * as functions from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import Razorpay from "razorpay";
import * as crypto from "crypto";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

admin.initializeApp();
const db = admin.firestore();

/* ── Razorpay client (lazy-init so secrets are resolved at runtime) ── */
function getRazorpay() {
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

/* ── Coin pack definitions (must match frontend COIN_PACKS) ── */
const COIN_PACKS: Record<string, { priceRs: number; coins: number; bonus: number; label: string }> = {
  Trial:   { priceRs: 50,   coins: 50,   bonus: 0,   label: "Trial"   },
  Starter: { priceRs: 200,  coins: 200,  bonus: 20,  label: "Starter" },
  Popular: { priceRs: 500,  coins: 500,  bonus: 75,  label: "Popular" },
  Pro:     { priceRs: 1000, coins: 1000, bonus: 175, label: "Pro"     },
  Society: { priceRs: 2500, coins: 2500, bonus: 500, label: "Society" },
};

/* ═══════════════════════════════════════════════════════
   1. createRazorpayOrder  — callable from browser
      Input:  { packLabel: string }
      Output: { orderId, amount, currency, keyId }
═══════════════════════════════════════════════════════ */
export const createRazorpayOrder = functions.onCall(
  {
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    region: "asia-south1",
  },
  async (request) => {
    // Auth guard
    if (!request.auth) {
      throw new functions.HttpsError("unauthenticated", "Login required.");
    }

    const { packLabel } = request.data as { packLabel: string };
    const pack = COIN_PACKS[packLabel];
    if (!pack) {
      throw new functions.HttpsError("invalid-argument", `Unknown pack: ${packLabel}`);
    }

    const razorpay = getRazorpay();

    // Create Razorpay order (amount in paise)
    const order = await razorpay.orders.create({
      amount:   pack.priceRs * 100,
      currency: "INR",
      receipt:  `nc_${request.auth.uid}_${Date.now()}`,
      notes: {
        uid:      request.auth.uid,
        packLabel,
        coins:    String(pack.coins + pack.bonus),
      },
    });

    logger.info("Razorpay order created", { orderId: order.id, uid: request.auth.uid });

    // Store pending purchase so webhook can validate
    await db.collection("coinPurchases").doc(order.id).set({
      uid:          request.auth.uid,
      orderId:      order.id,
      amountPaid:   pack.priceRs,
      coinsGranted: pack.coins + pack.bonus,
      packLabel:    pack.label,
      status:       "pending",
      createdAt:    FieldValue.serverTimestamp(),
    });

    return {
      orderId:  order.id,
      amount:   pack.priceRs * 100,   // paise
      currency: "INR",
      keyId:    process.env.RAZORPAY_KEY_ID,
    };
  }
);

/* ═══════════════════════════════════════════════════════
   2. razorpayWebhook  — HTTPS endpoint for Razorpay
      Razorpay Dashboard → Webhooks → URL: /razorpayWebhook
      Events to enable: payment.captured
═══════════════════════════════════════════════════════ */
export const razorpayWebhook = functions.onRequest(
  {
    secrets: ["RAZORPAY_WEBHOOK_SECRET"],
    region: "asia-south1",
  },
  async (req, res) => {
    // 1. Verify Razorpay signature
    const signature  = req.headers["x-razorpay-signature"] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const rawBody    = JSON.stringify(req.body);

    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSig) {
      logger.warn("Webhook signature mismatch");
      res.status(400).send("Invalid signature");
      return;
    }

    const event = req.body;

    // 2. Handle payment.captured only
    if (event.event !== "payment.captured") {
      res.status(200).send("Ignored");
      return;
    }

    const payment  = event.payload.payment.entity;
    const orderId  = payment.order_id as string;
    const paymentId = payment.id as string;

    logger.info("Payment captured", { orderId, paymentId });

    // 3. Idempotency — check if already processed
    const purchaseRef = db.collection("coinPurchases").doc(orderId);
    const purchaseSnap = await purchaseRef.get();

    if (!purchaseSnap.exists) {
      logger.error("Purchase doc not found", { orderId });
      res.status(200).send("Order not found — ignored");
      return;
    }

    const purchase = purchaseSnap.data()!;

    if (purchase.status === "completed") {
      logger.info("Already processed", { orderId });
      res.status(200).send("Already processed");
      return;
    }

    const uid          = purchase.uid as string;
    const coinsGranted = purchase.coinsGranted as number;
    const packLabel    = purchase.packLabel as string;
    const amountPaid   = purchase.amountPaid as number;

    // 4. Atomic: credit coins + ledger + mark purchase complete
    await db.runTransaction(async (tx) => {
      const userRef  = db.collection("users").doc(uid);
      const userSnap = await tx.get(userRef);

      if (!userSnap.exists) throw new Error(`User not found: ${uid}`);

      const currentBalance = (userSnap.data()?.coinBalance as number) ?? 0;
      const newBalance     = currentBalance + coinsGranted;

      // Update user balance
      tx.update(userRef, {
        coinBalance: newBalance,
        updatedAt:   FieldValue.serverTimestamp(),
      });

      // Mark purchase complete
      tx.update(purchaseRef, {
        status:      "completed",
        paymentId,
        completedAt: FieldValue.serverTimestamp(),
      });

      // Append immutable ledger entry
      const ledgerRef = db
        .collection("coinLedger")
        .doc(uid)
        .collection("entries")
        .doc(); // auto-id

      tx.set(ledgerRef, {
        uid,
        type:         "topup",
        amount:       coinsGranted,
        balanceAfter: newBalance,
        description:  `${packLabel} Pack — ₹${amountPaid} → ${coinsGranted} NC`,
        refId:        orderId,
        paymentId,
        createdAt:    FieldValue.serverTimestamp(),
      });
    });

    logger.info("Coins credited", { uid, coinsGranted });
    res.status(200).send("OK");
  }
);

/* ═══════════════════════════════════════════════════════
   3. generateCloudinarySignature — Signed Uploads Validation
═══════════════════════════════════════════════════════ */
export const generateCloudinarySignature = functions.onCall(
  {
    secrets: ["CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    region: "asia-south1",
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError("unauthenticated", "Login required.");
    }
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = "ProNeighbor/residency-proofs";
    const apiKey = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;
    
    // Cloudinary signature does NOT include api_key or file in the string
    // Format: folder=MyFolder&timestamp=12345678MySecret
    const strToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(strToSign).digest("hex");

    return { 
      signature, 
      timestamp, 
      folder, 
      apiKey 
    };
  }
);

/* ═══════════════════════════════════════════════════════
   4. logActivityFunction — Rate-limited server-side logging
═══════════════════════════════════════════════════════ */
const activityRateLimitCache = new Map<string, number>();

export const logActivityFunction = functions.onCall(
  {
    region: "asia-south1",
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.HttpsError("unauthenticated", "Login required.");
    }
    const { event, details, metadata } = request.data;
    if (!event || !details) {
      throw new functions.HttpsError("invalid-argument", "Missing required fields.");
    }

    const uid = request.auth.uid;
    const now = Date.now();
    const lastTime = activityRateLimitCache.get(uid);

    // Enforce 2-second rate limit per instance to prevent spam
    if (lastTime && now - lastTime < 2000) {
      logger.warn("Activity log rate limited for user", { uid, event });
      throw new functions.HttpsError("resource-exhausted", "Too many requests. Please wait.");
    }
    
    // Prune the map occasionally to prevent memory leaks in long-running instances
    if (activityRateLimitCache.size > 1000) {
      activityRateLimitCache.clear();
    }
    activityRateLimitCache.set(uid, now);

    // Bypass client-side security rules by writing via Admin SDK
    await db.collection("activityLogs").add({
      userId: uid,
      event,
      details,
      metadata: metadata || {},
      timestamp: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }
);

/* ═══════════════════════════════════════════════════════
  5. flagSpamReviews — server-side automated review abuse signal
═══════════════════════════════════════════════════════ */
export const flagSpamReviews = onDocumentCreated(
  {
    document: "reviews/{reviewId}",
    region: "asia-south1",
  },
  async (event) => {
    const review = event.data?.data();
    const proId = review?.proId;

    if (typeof proId !== "string" || !proId) {
      return;
    }

    const recentReviews = await db
      .collection("reviews")
      .where("proId", "==", proId)
      .orderBy("createdAt", "desc")
      .limit(3)
      .get();

    if (recentReviews.size < 3) {
      return;
    }

    const allOneStar = recentReviews.docs.every(doc => {
      const rating = Number(doc.data().rating ?? 0);
      return rating <= 1;
    });

    if (!allOneStar) {
      return;
    }

    const existingFlag = await db
      .collection("reports")
      .where("proId", "==", proId)
      .where("reason", "==", "Automated Spam Flag")
      .where("status", "==", "pending")
      .limit(1)
      .get();

    if (!existingFlag.empty) {
      return;
    }

    await db.collection("reports").add({
      proId,
      reason: "Automated Spam Flag",
      comment: "3 consecutive 1-star reviews detected rapidly.",
      reporterId: "system",
      source: "review_spam_trigger",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info("Automated spam review flag created", { proId });
  }
);
