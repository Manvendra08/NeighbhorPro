"use strict";
/**
 * BLAZE PLAN ONLY — Phase 2 Subscription Cloud Functions
 *
 * Exports:
 *   subscribeWithNCCallable  — HTTPS callable: server-side NC debit for subscription
 *   activateTrialCallable    — HTTPS callable: enroll free trial
 *   dailyRenewalSweep        — Scheduled (02:00 IST daily): renewal reminders + expiry sweep
 *   adminSubscriptionAction  — HTTPS callable: admin comp / pause / force-cancel
 *
 * Set in Firebase Functions config:
 *   No additional secrets needed (NC-only; no Razorpay for subscriptions).
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSubscriptionAction = exports.dailyRenewalSweep = exports.activateTrialCallable = exports.subscribeWithNCCallable = void 0;
const functions = __importStar(require("firebase-functions/v2/https"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
// admin.initializeApp() is called in index.ts — do not call again here.
const db = admin.firestore();
// ── Plan definitions (must match frontend SUB_PLANS) ─────────────────────────
const PAID_PLANS = {
    business_3m_v1: { durationDays: 90, priceNC: 999, label: "3 Months" },
    business_6m_v1: { durationDays: 180, priceNC: 1799, label: "6 Months" },
    business_12m_v1: { durationDays: 365, priceNC: 2299, label: "12 Months" },
};
const DEFAULT_BUSINESS_CATEGORIES = [
    "Tuition & Coaching",
    "Yoga & Fitness",
    "Music & Dance",
    "Language Classes",
    "Nutrition & Diet",
];
async function getBusinessCategories() {
    try {
        const snap = await db.collection("config").doc("platformSettings").get();
        const data = snap.data();
        if (data && Array.isArray(data.businessCategories) && data.businessCategories.length > 0) {
            return data.businessCategories.filter((c) => typeof c === "string" && c.length > 0);
        }
    }
    catch (err) {
        logger.warn("Failed to fetch businessCategories from platformSettings, using fallback", err);
    }
    return DEFAULT_BUSINESS_CATEGORIES;
}
const ACTIVE_STATUSES = new Set([
    "trial", "trial_ending", "active", "renewing", "past_due", "grace", "comped",
]);
function addDaysDSTSafe(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
// ─── Helper: write wallet-kind notification ───────────────────────────────────
async function writeNotification(uid, title, body, actionUrl) {
    await db.collection("notifications").add({
        uid,
        kind: "wallet",
        title,
        body,
        actionUrl,
        read: false,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
// ─── Helper: batch-flip Business services to paused_subscription ──────────────
async function pauseBusinessListings(uid) {
    const bizCategories = await getBusinessCategories();
    const validCategories = bizCategories.slice(0, 30); // Firestore 'in' limit is 30
    const servicesSnap = await db
        .collection("services")
        .where("userId", "==", uid)
        .where("category", "in", validCategories)
        .get();
    if (servicesSnap.empty)
        return;
    const batch = db.batch();
    servicesSnap.docs.forEach(d => {
        batch.update(d.ref, { subStatus: "paused_subscription", updatedAt: firestore_1.FieldValue.serverTimestamp() });
    });
    await batch.commit();
}
// ─── Helper: restore Business services ────────────────────────────────────────
async function restoreBusinessListings(uid) {
    const servicesSnap = await db
        .collection("services")
        .where("userId", "==", uid)
        .where("subStatus", "==", "paused_subscription")
        .get();
    if (servicesSnap.empty)
        return;
    const batch = db.batch();
    servicesSnap.docs.forEach(d => {
        batch.update(d.ref, { subStatus: "active", updatedAt: firestore_1.FieldValue.serverTimestamp() });
    });
    await batch.commit();
}
// ══════════════════════════════════════════════════════════════════════════════
// 1. subscribeWithNCCallable — Hardened server-side NC debit
// Input:  { uid: string; planId: string }
// Output: { subId: string; status: string; periodEnd: string }
// ══════════════════════════════════════════════════════════════════════════════
exports.subscribeWithNCCallable = functions.onCall({ region: "asia-south1" }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid)
        throw new functions.HttpsError("unauthenticated", "Must be signed in.");
    const { uid, planId } = request.data;
    if (!uid || uid !== callerUid) {
        throw new functions.HttpsError("permission-denied", "UID mismatch.");
    }
    if (!planId || !PAID_PLANS[planId]) {
        throw new functions.HttpsError("invalid-argument", "Invalid plan ID.");
    }
    const plan = PAID_PLANS[planId];
    try {
        const subDoc = await db.runTransaction(async (tx) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists)
                throw new functions.HttpsError("not-found", "User not found.");
            const userData = userSnap.data();
            const cashable = userData.cashableBalance ?? 0;
            if (cashable < plan.priceNC) {
                throw new functions.HttpsError("resource-exhausted", "INSUFFICIENT_CASHABLE_BALANCE");
            }
            // Idempotency + active-sub guard (read from user snap inside transaction)
            const currentSub = userData.subscription;
            if (currentSub && currentSub.status && ACTIVE_STATUSES.has(currentSub.status)) {
                const end = currentSub.currentPeriodEnd?.toDate();
                if (end && end > new Date()) {
                    throw new functions.HttpsError("already-exists", "ACTIVE_SUB_EXISTS");
                }
            }
            const ledgerEntryId = `sub_debit_${uid}_${Date.now()}`;
            const ledgerRef = db.collection("coinLedger").doc(uid).collection("entries").doc(ledgerEntryId);
            const ledgerSnap = await tx.get(ledgerRef);
            if (ledgerSnap.exists)
                throw new functions.HttpsError("already-exists", "DUPLICATE_LEDGER_ENTRY");
            const now = new Date();
            const periodEnd = addDaysDSTSafe(now, plan.durationDays);
            const periodEndTs = firestore_1.Timestamp.fromDate(periodEnd);
            const nowTs = firestore_1.Timestamp.fromDate(now);
            const newCashable = cashable - plan.priceNC;
            const subId = `sub_${uid}_${ledgerEntryId}`;
            const subRef = db.collection("subscriptions").doc(subId);
            const invRef = db.collection("subscriptionInvoices").doc(`inv_${ledgerEntryId}`);
            tx.set(ledgerRef, {
                uid,
                type: "subscription_debit",
                amount: -plan.priceNC,
                balanceAfter: newCashable,
                description: `Business Listing — ${plan.label}`,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            });
            tx.set(subRef, {
                uid, plan: planId, status: "active", currency: "NC",
                amount: plan.priceNC,
                currentPeriodStart: nowTs, currentPeriodEnd: periodEndTs,
                cancelAtPeriodEnd: false,
                lastInvoiceId: `inv_${ledgerEntryId}`,
                source: "coins",
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            tx.set(invRef, {
                subId, uid, plan: planId,
                periodStart: nowTs, periodEnd: periodEndTs,
                amount: plan.priceNC, currency: "NC",
                paidAt: firestore_1.FieldValue.serverTimestamp(),
                paymentMethod: "coins",
                ledgerEntryId,
                status: "paid",
            });
            tx.update(userRef, {
                cashableBalance: newCashable,
                subscription: {
                    status: "active",
                    currentPeriodEnd: periodEndTs,
                    plan: planId,
                    trialUsed: true,
                    cancelAtPeriodEnd: false,
                },
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            // Restore any previously paused Business listings
            await restoreBusinessListings(uid);
            return { subId, periodEnd: periodEnd.toISOString() };
        });
        return { ...subDoc, status: "active" };
    }
    catch (err) {
        if (err instanceof functions.HttpsError)
            throw err;
        logger.error("subscribeWithNCCallable error", err);
        throw new functions.HttpsError("internal", "Subscription failed. Please try again.");
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 2. activateTrialCallable — Server-side trial enrollment
// Input:  { uid: string }
// Output: { subId: string; periodEnd: string }
// ══════════════════════════════════════════════════════════════════════════════
exports.activateTrialCallable = functions.onCall({ region: "asia-south1" }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid)
        throw new functions.HttpsError("unauthenticated", "Must be signed in.");
    const { uid } = request.data;
    if (!uid || uid !== callerUid) {
        throw new functions.HttpsError("permission-denied", "UID mismatch.");
    }
    try {
        const result = await db.runTransaction(async (tx) => {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists)
                throw new functions.HttpsError("not-found", "User not found.");
            const userData = userSnap.data();
            if (userData.trialUsed === true) {
                throw new functions.HttpsError("already-exists", "TRIAL_ALREADY_USED");
            }
            const existingSnap = await db
                .collection("subscriptions")
                .where("uid", "==", uid)
                .where("status", "not-in", ["expired", "cancelled"])
                .limit(1)
                .get();
            if (!existingSnap.empty) {
                throw new functions.HttpsError("already-exists", "ACTIVE_SUB_EXISTS");
            }
            const now = new Date();
            const periodEnd = addDaysDSTSafe(now, 30);
            const periodEndTs = firestore_1.Timestamp.fromDate(periodEnd);
            const nowTs = firestore_1.Timestamp.fromDate(now);
            const subId = `sub_${uid}_trial`;
            tx.set(db.collection("subscriptions").doc(subId), {
                uid, plan: "business_trial_v1", status: "trial", currency: "free",
                amount: 0,
                currentPeriodStart: nowTs, currentPeriodEnd: periodEndTs,
                cancelAtPeriodEnd: false, source: "trial",
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            tx.set(db.collection("subscriptionInvoices").doc(`inv_trial_${uid}`), {
                subId, uid, plan: "business_trial_v1",
                periodStart: nowTs, periodEnd: periodEndTs,
                amount: 0, currency: "free",
                paidAt: firestore_1.FieldValue.serverTimestamp(),
                paymentMethod: "trial", status: "trial",
            });
            tx.update(userRef, {
                trialUsed: true,
                subscription: {
                    status: "trial",
                    currentPeriodEnd: periodEndTs,
                    plan: "business_trial_v1",
                    trialUsed: true,
                    cancelAtPeriodEnd: false,
                },
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            return { subId, periodEnd: periodEnd.toISOString() };
        });
        return result;
    }
    catch (err) {
        if (err instanceof functions.HttpsError)
            throw err;
        logger.error("activateTrialCallable error", err);
        throw new functions.HttpsError("internal", "Failed to activate trial.");
    }
});
// ══════════════════════════════════════════════════════════════════════════════
// 3. dailyRenewalSweep — Scheduled 02:00 IST daily
//
// Checks config/platformSettings.subscription.cronEnabled before running.
// Phases:
//   T-7, T-3, T-1 from trial end → renewal reminder notification
//   T+0 (expired today) → flip status=expired, pause listings
// ══════════════════════════════════════════════════════════════════════════════
exports.dailyRenewalSweep = (0, scheduler_1.onSchedule)({
    schedule: "0 2 * * *", // 02:00 UTC daily (IST = UTC+5:30 → use "20 20 * * *" for 02:00 IST if needed)
    timeZone: "Asia/Kolkata",
    region: "asia-south1",
    memory: "512MiB",
}, async () => {
    // Check if cron is enabled in platform settings
    const settingsSnap = await db.collection("config").doc("platformSettings").get();
    const settings = settingsSnap.data() ?? {};
    const cronEnabled = settings.subscription?.cronEnabled === true
        || settings.subscriptionCronEnabled === true; // fallback key
    if (!cronEnabled) {
        logger.info("dailyRenewalSweep: cronEnabled=false, skipping.");
        return;
    }
    const now = new Date();
    const gracePeriodDays = settings.subscription?.business?.gracePeriodDays
        ?? settings.subscriptionGracePeriodDays
        ?? 5;
    logger.info(`dailyRenewalSweep start. gracePeriodDays=${gracePeriodDays}`);
    // Fetch all non-expired, non-cancelled subscriptions
    const activeSnap = await db
        .collection("subscriptions")
        .where("status", "in", ["trial", "trial_ending", "active", "renewing", "past_due", "grace"])
        .get();
    let reminded = 0;
    let expired = 0;
    for (const subDoc of activeSnap.docs) {
        const sub = subDoc.data();
        const uid = sub.uid;
        const endTs = sub.currentPeriodEnd;
        if (!endTs)
            continue;
        const endDate = endTs.toDate();
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);
        const isTrial = sub.plan === "business_trial_v1";
        // ── Reminder notifications (T-7, T-3, T-1) ───────────────────────────
        if ([7, 3, 1].includes(daysLeft)) {
            const title = isTrial
                ? `Free trial ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`
                : `Business subscription renews in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`;
            const body = isTrial
                ? "Choose a plan to keep your listing live after the trial."
                : "Top up your wallet or renew your plan to keep your listing active.";
            await writeNotification(uid, title, body, "/profile/subscription").catch(e => logger.warn("notification write failed", { uid, error: e }));
            reminded++;
            continue;
        }
        // ── Expiry processing (daysLeft <= 0) ─────────────────────────────────
        if (daysLeft <= 0) {
            const daysExpired = Math.abs(daysLeft); // days since expiry
            if (daysExpired <= gracePeriodDays) {
                // In grace window — mark past_due
                if (sub.status !== "past_due" && sub.status !== "grace") {
                    await subDoc.ref.update({
                        status: daysExpired >= gracePeriodDays - 1 ? "grace" : "past_due",
                        updatedAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                    await db.collection("users").doc(uid).update({
                        "subscription.status": daysExpired >= gracePeriodDays - 1 ? "grace" : "past_due",
                        updatedAt: firestore_1.FieldValue.serverTimestamp(),
                    }).catch(() => { }); // user doc might not exist yet — ignore
                }
            }
            else {
                // Grace period over — expire and pause listings
                if (sub.status !== "expired") {
                    await subDoc.ref.update({
                        status: "expired",
                        updatedAt: firestore_1.FieldValue.serverTimestamp(),
                    });
                    await db.collection("users").doc(uid).update({
                        "subscription.status": "expired",
                        updatedAt: firestore_1.FieldValue.serverTimestamp(),
                    }).catch(() => { });
                    await pauseBusinessListings(uid);
                    await writeNotification(uid, "Business listing paused", "Your subscription expired. Renew to reactivate your listing.", "/profile/subscription").catch(e => logger.warn("notification write failed", { uid, error: e }));
                    expired++;
                }
            }
        }
    }
    logger.info(`dailyRenewalSweep done. reminded=${reminded} expired=${expired}`);
});
// ══════════════════════════════════════════════════════════════════════════════
// 4. adminSubscriptionAction — HTTPS callable
// Input:  { action: 'comp'|'pause'|'force_cancel'; uid: string; planId?: string; reason?: string }
// Output: { success: boolean }
// ══════════════════════════════════════════════════════════════════════════════
exports.adminSubscriptionAction = functions.onCall({ region: "asia-south1" }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid)
        throw new functions.HttpsError("unauthenticated", "Must be signed in.");
    // Verify caller is admin (JWT claim + doc fallback)
    if (!request.auth?.token?.admin) {
        const adminSnap = await db.collection("users").doc(callerUid).get();
        if (!adminSnap.exists || adminSnap.data()?.role !== "admin") {
            throw new functions.HttpsError("permission-denied", "Admin only.");
        }
    }
    const adminSnap = await db.collection("users").doc(callerUid).get();
    const { action, uid, planId, reason } = request.data;
    if (!uid || !action)
        throw new functions.HttpsError("invalid-argument", "uid and action required.");
    if (action === "comp") {
        if (!planId || !PAID_PLANS[planId]) {
            throw new functions.HttpsError("invalid-argument", "Valid planId required for comp.");
        }
        const plan = PAID_PLANS[planId];
        const now = new Date();
        const periodEnd = addDaysDSTSafe(now, plan.durationDays);
        const periodEndTs = firestore_1.Timestamp.fromDate(periodEnd);
        const subId = `sub_${uid}_comp_${Date.now()}`;
        await db.runTransaction(async (tx) => {
            tx.set(db.collection("subscriptions").doc(subId), {
                uid, plan: planId, status: "comped", currency: "free",
                amount: 0,
                currentPeriodStart: firestore_1.Timestamp.fromDate(now),
                currentPeriodEnd: periodEndTs,
                cancelAtPeriodEnd: false, source: "comp",
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
            tx.update(db.collection("users").doc(uid), {
                subscription: {
                    status: "comped",
                    currentPeriodEnd: periodEndTs,
                    plan: planId,
                    cancelAtPeriodEnd: false,
                },
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        });
        await db.collection("auditLogs").add({
            action: "subscription_comp_granted",
            adminId: callerUid,
            adminName: adminSnap.data()?.displayName ?? "Admin",
            targetId: uid,
            details: reason ?? "Comp granted",
            metadata: { plan: planId, subId },
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await writeNotification(uid, "ProNeighbor sponsored your listing 🎉", `You received a complimentary ${plan.label} Business listing plan.`, "/profile/subscription");
        return { success: true };
    }
    if (action === "pause") {
        const existingSnap = await db
            .collection("subscriptions")
            .where("uid", "==", uid)
            .where("status", "not-in", ["expired", "cancelled"])
            .limit(1)
            .get();
        if (!existingSnap.empty) {
            await existingSnap.docs[0].ref.update({ status: "paused", updatedAt: firestore_1.FieldValue.serverTimestamp() });
        }
        await db.collection("users").doc(uid).update({
            "subscription.status": "paused",
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await pauseBusinessListings(uid);
        await db.collection("auditLogs").add({
            action: "subscription_paused",
            adminId: callerUid,
            adminName: adminSnap.data()?.displayName ?? "Admin",
            targetId: uid,
            details: reason ?? "Admin pause",
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { success: true };
    }
    if (action === "force_cancel") {
        const existingSnap = await db
            .collection("subscriptions")
            .where("uid", "==", uid)
            .where("status", "not-in", ["expired", "cancelled"])
            .limit(1)
            .get();
        if (!existingSnap.empty) {
            await existingSnap.docs[0].ref.update({
                status: "cancelled",
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        await db.collection("users").doc(uid).update({
            "subscription.status": "expired",
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        await pauseBusinessListings(uid);
        await db.collection("auditLogs").add({
            action: "subscription_force_cancelled",
            adminId: callerUid,
            adminName: adminSnap.data()?.displayName ?? "Admin",
            targetId: uid,
            details: reason ?? "Admin force cancel",
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return { success: true };
    }
    throw new functions.HttpsError("invalid-argument", `Unknown action: ${action}`);
});
//# sourceMappingURL=subscriptions.js.map