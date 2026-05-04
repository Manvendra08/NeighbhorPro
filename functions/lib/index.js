"use strict";
/**
 * BLAZE PLAN ONLY
 *
 * These Cloud Functions are not used in the Spark-plan client-only deployment.
 * Keep this file for future Blaze migration only. Do not rely on it in Spark.
 *
 * Firebase Cloud Functions â€” NeighbourCoins Ã— Razorpay
 *
 * Exports:
 *   createRazorpayOrder  â€” HTTPS callable: browser calls this to get an order_id
 *   razorpayWebhook      â€” HTTPS endpoint: Razorpay POSTs here on payment.captured
 *
 * Environment config (set via Firebase Functions config):
 *   firebase functions:secrets:set RAZORPAY_KEY_ID
 *   firebase functions:secrets:set RAZORPAY_KEY_SECRET
 *   firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flagSpamReviews = exports.deleteUserAuth = exports.logActivityFunction = exports.getResidencyProofDownloadUrl = exports.generateCloudinarySignature = exports.razorpayWebhook = exports.createRazorpayOrder = void 0;
const functions = __importStar(require("firebase-functions/v2/https"));
const firestore_1 = require("firebase-functions/v2/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const razorpay_1 = __importDefault(require("razorpay"));
const crypto = __importStar(require("crypto"));
const firestore_2 = require("firebase-admin/firestore");
admin.initializeApp();
const db = admin.firestore();
/* â”€â”€ Razorpay client (lazy-init so secrets are resolved at runtime) â”€â”€ */
function getRazorpay() {
    return new razorpay_1.default({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
}
/* â”€â”€ Coin pack definitions (must match frontend COIN_PACKS) â”€â”€ */
const COIN_PACKS = {
    Trial: { priceRs: 50, coins: 50, bonus: 0, label: "Trial" },
    Starter: { priceRs: 200, coins: 200, bonus: 20, label: "Starter" },
    Popular: { priceRs: 500, coins: 500, bonus: 75, label: "Popular" },
    Pro: { priceRs: 1000, coins: 1000, bonus: 175, label: "Pro" },
    Society: { priceRs: 2500, coins: 2500, bonus: 500, label: "Society" },
};
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   1. createRazorpayOrder  â€” callable from browser
      Input:  { packLabel: string }
      Output: { orderId, amount, currency, keyId }
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
exports.createRazorpayOrder = functions.onCall({
    secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
    region: "asia-south1",
}, async (request) => {
    // Auth guard
    if (!request.auth) {
        throw new functions.HttpsError("unauthenticated", "Login required.");
    }
    const { packLabel } = request.data;
    const pack = COIN_PACKS[packLabel];
    if (!pack) {
        throw new functions.HttpsError("invalid-argument", `Unknown pack: ${packLabel}`);
    }
    const razorpay = getRazorpay();
    // Create Razorpay order (amount in paise)
    const order = await razorpay.orders.create({
        amount: pack.priceRs * 100,
        currency: "INR",
        receipt: `nc_${request.auth.uid}_${Date.now()}`,
        notes: {
            uid: request.auth.uid,
            packLabel,
            coins: String(pack.coins + pack.bonus),
        },
    });
    logger.info("Razorpay order created", { orderId: order.id, uid: request.auth.uid });
    // Store pending purchase so webhook can validate
    await db.collection("coinPurchases").doc(order.id).set({
        uid: request.auth.uid,
        orderId: order.id,
        amountPaid: pack.priceRs,
        coinsGranted: pack.coins + pack.bonus,
        packLabel: pack.label,
        status: "pending",
        createdAt: firestore_2.FieldValue.serverTimestamp(),
    });
    return {
        orderId: order.id,
        amount: pack.priceRs * 100, // paise
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID,
    };
});
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   2. razorpayWebhook  â€” HTTPS endpoint for Razorpay
      Razorpay Dashboard â†’ Webhooks â†’ URL: /razorpayWebhook
      Events to enable: payment.captured
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
exports.razorpayWebhook = functions.onRequest({
    secrets: ["RAZORPAY_WEBHOOK_SECRET"],
    region: "asia-south1",
}, async (req, res) => {
    // 1. Verify Razorpay signature
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const rawBody = JSON.stringify(req.body);
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
    const payment = event.payload.payment.entity;
    const orderId = payment.order_id;
    const paymentId = payment.id;
    logger.info("Payment captured", { orderId, paymentId });
    // 3. Idempotency â€” check if already processed
    const purchaseRef = db.collection("coinPurchases").doc(orderId);
    const purchaseSnap = await purchaseRef.get();
    if (!purchaseSnap.exists) {
        logger.error("Purchase doc not found", { orderId });
        res.status(200).send("Order not found â€” ignored");
        return;
    }
    const purchase = purchaseSnap.data();
    if (purchase.status === "completed") {
        logger.info("Already processed", { orderId });
        res.status(200).send("Already processed");
        return;
    }
    const uid = purchase.uid;
    const coinsGranted = purchase.coinsGranted;
    const packLabel = purchase.packLabel;
    const amountPaid = purchase.amountPaid;
    // 4. Atomic: credit coins + ledger + mark purchase complete
    await db.runTransaction(async (tx) => {
        var _a, _b;
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists)
            throw new Error(`User not found: ${uid}`);
        const currentBalance = (_b = (_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.coinBalance) !== null && _b !== void 0 ? _b : 0;
        const newBalance = currentBalance + coinsGranted;
        // Update user balance
        tx.update(userRef, {
            coinBalance: newBalance,
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        // Mark purchase complete
        tx.update(purchaseRef, {
            status: "completed",
            paymentId,
            completedAt: firestore_2.FieldValue.serverTimestamp(),
        });
        // Append immutable ledger entry
        const ledgerRef = db
            .collection("coinLedger")
            .doc(uid)
            .collection("entries")
            .doc(); // auto-id
        tx.set(ledgerRef, {
            uid,
            type: "topup",
            amount: coinsGranted,
            balanceAfter: newBalance,
            description: `${packLabel} Pack â€” â‚¹${amountPaid} â†’ ${coinsGranted} NC`,
            refId: orderId,
            paymentId,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
        });
    });
    logger.info("Coins credited", { uid, coinsGranted });
    res.status(200).send("OK");
});
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   3. generateCloudinarySignature â€” Signed Uploads Validation
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
exports.generateCloudinarySignature = functions.onCall({
    secrets: ["CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    region: "asia-south1",
}, async (request) => {
    if (!request.auth) {
        throw new functions.HttpsError("unauthenticated", "Login required.");
    }
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = "ProNeighbor/residency-proofs";
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
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
});
function parseCloudinaryProofUrl(url) {
    var _a, _b;
    const clean = (_b = (_a = url.split("?")[0]) === null || _a === void 0 ? void 0 : _a.split("#")[0]) === null || _b === void 0 ? void 0 : _b.trim();
    if (!clean)
        return null;
    const withVersion = clean.match(/^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(?:[^/]+\/)*v\d+\/(.+)\.([a-zA-Z0-9]+)$/);
    const withoutVersion = clean.match(/^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(?:[^/]+\/)*(.+)\.([a-zA-Z0-9]+)$/);
    const match = withVersion || withoutVersion;
    if (!match)
        return null;
    const resourceType = match[1];
    const publicId = decodeURIComponent(match[2]);
    const format = match[3].toLowerCase();
    return { resourceType, publicId, format };
}
function signCloudinaryParams(params, apiSecret) {
    const sorted = Object.keys(params)
        .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");
    return crypto.createHash("sha1").update(`${sorted}${apiSecret}`).digest("hex");
}
exports.getResidencyProofDownloadUrl = functions.onCall({
    secrets: ["CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    region: "asia-south1",
}, async (request) => {
    var _a, _b;
    if (!request.auth) {
        throw new functions.HttpsError("unauthenticated", "Login required.");
    }
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    if (!callerDoc.exists || ((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== "admin") {
        throw new functions.HttpsError("permission-denied", "Admin only.");
    }
    const proofUrl = typeof ((_b = request.data) === null || _b === void 0 ? void 0 : _b.proofUrl) === "string" ? request.data.proofUrl.trim() : "";
    if (!proofUrl) {
        throw new functions.HttpsError("invalid-argument", "proofUrl is required.");
    }
    const parsed = parseCloudinaryProofUrl(proofUrl);
    if (!parsed) {
        throw new functions.HttpsError("invalid-argument", "Invalid Cloudinary proof URL.");
    }
    const cloudNameMatch = proofUrl.match(/^https?:\/\/res\.cloudinary\.com\/([^/]+)\//);
    const cloudName = cloudNameMatch === null || cloudNameMatch === void 0 ? void 0 : cloudNameMatch[1];
    if (!cloudName) {
        throw new functions.HttpsError("invalid-argument", "Cloud name missing in proof URL.");
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + 300;
    const paramsToSign = {
        attachment: "true",
        expires_at: String(expiresAt),
        format: parsed.format,
        public_id: parsed.publicId,
        resource_type: parsed.resourceType,
        timestamp: String(timestamp),
        type: "upload",
    };
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const signature = signCloudinaryParams(paramsToSign, apiSecret);
    const query = new URLSearchParams({
        api_key: apiKey,
        attachment: "true",
        expires_at: String(expiresAt),
        format: parsed.format,
        public_id: parsed.publicId,
        signature,
        timestamp: String(timestamp),
        type: "upload",
    });
    const downloadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${parsed.resourceType}/download?${query.toString()}`;
    return { downloadUrl };
});
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   4. logActivityFunction â€” Rate-limited server-side logging
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const activityRateLimitCache = new Map();
exports.logActivityFunction = functions.onCall({
    region: "asia-south1",
}, async (request) => {
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
        timestamp: firestore_2.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   6. deleteUserAuth â€” Hard-delete Firebase Auth account
      Called by admin after cascade Firestore deletion.
      Admin SDK bypasses client auth restrictions.
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
exports.deleteUserAuth = functions.onCall({ region: "asia-south1" }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new functions.HttpsError("unauthenticated", "Login required.");
    }
    // Verify caller is admin
    const callerDoc = await db.collection("users").doc(request.auth.uid).get();
    if (!callerDoc.exists || ((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== "admin") {
        throw new functions.HttpsError("permission-denied", "Admin only.");
    }
    const { uid } = request.data;
    if (!uid || typeof uid !== "string") {
        throw new functions.HttpsError("invalid-argument", "uid required.");
    }
    // Prevent self-deletion
    if (uid === request.auth.uid) {
        throw new functions.HttpsError("failed-precondition", "Cannot delete own account.");
    }
    try {
        await admin.auth().deleteUser(uid);
        logger.info("Auth account deleted", { uid, by: request.auth.uid });
        return { success: true };
    }
    catch (err) {
        // user-not-found = already deleted, treat as success
        if ((err === null || err === void 0 ? void 0 : err.code) === "auth/user-not-found") {
            return { success: true, alreadyDeleted: true };
        }
        logger.error("Failed to delete auth account", { uid, err });
        throw new functions.HttpsError("internal", "Failed to delete auth account.");
    }
});
/* ------------------------------------------------------------------------- */
exports.flagSpamReviews = (0, firestore_1.onDocumentCreated)({
    document: "reviews/{reviewId}",
    region: "asia-south1",
}, async (event) => {
    var _a;
    const review = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    const proId = review === null || review === void 0 ? void 0 : review.proId;
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
        var _a;
        const rating = Number((_a = doc.data().rating) !== null && _a !== void 0 ? _a : 0);
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
        createdAt: firestore_2.FieldValue.serverTimestamp(),
    });
    logger.info("Automated spam review flag created", { proId });
});
//# sourceMappingURL=index.js.map