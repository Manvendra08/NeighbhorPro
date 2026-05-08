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

import * as functions from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// admin.initializeApp() is called in index.ts — do not call again here.
const db = admin.firestore();

// ── Plan definitions (must match frontend SUB_PLANS) ─────────────────────────
const PAID_PLANS: Record<string, { durationDays: number; priceNC: number; label: string }> = {
  business_3m_v1:  { durationDays: 90,  priceNC: 999,  label: "3 Months"  },
  business_6m_v1:  { durationDays: 180, priceNC: 1799, label: "6 Months"  },
  business_12m_v1: { durationDays: 365, priceNC: 2299, label: "12 Months" },
};

const BUSINESS_CATEGORIES = [
  "Tuition & Coaching",
  "Yoga & Fitness",
  "Music & Dance",
  "Language Classes",
  "Nutrition & Diet",
];

const ACTIVE_STATUSES = new Set([
  "trial", "trial_ending", "active", "renewing", "past_due", "grace", "comped",
]);

// ─── Helper: is sub period still live? ───────────────────────────────────────
function isLive(currentPeriodEnd: admin.firestore.Timestamp): boolean {
  return currentPeriodEnd.toMillis() > Date.now();
}

// ─── Helper: write wallet-kind notification ───────────────────────────────────
async function writeNotification(
  uid: string,
  title: string,
  body: string,
  actionUrl: string
): Promise<void> {
  await db.collection("notifications").add({
    uid,
    kind: "wallet",
    title,
    body,
    actionUrl,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

// ─── Helper: batch-flip Business services to paused_subscription ──────────────
async function pauseBusinessListings(uid: string): Promise<void> {
  const servicesSnap = await db
    .collection("services")
    .where("userId", "==", uid)
    .where("category", "in", BUSINESS_CATEGORIES)
    .get();

  if (servicesSnap.empty) return;

  const batch = db.batch();
  servicesSnap.docs.forEach(d => {
    batch.update(d.ref, { subStatus: "paused_subscription", updatedAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();
}

// ─── Helper: restore Business services ────────────────────────────────────────
async function restoreBusinessListings(uid: string): Promise<void> {
  const servicesSnap = await db
    .collection("services")
    .where("userId", "==", uid)
    .where("subStatus", "==", "paused_subscription")
    .get();

  if (servicesSnap.empty) return;

  const batch = db.batch();
  servicesSnap.docs.forEach(d => {
    batch.update(d.ref, { subStatus: "active", updatedAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. subscribeWithNCCallable — Hardened server-side NC debit
// Input:  { uid: string; planId: string }
// Output: { subId: string; status: string; periodEnd: string }
// ══════════════════════════════════════════════════════════════════════════════
export const subscribeWithNCCallable = functions.onCall(
  { region: "asia-south1" },
  async (request: any) => {
    const callerUid: string = request.auth?.uid;
    if (!callerUid) throw new functions.HttpsError("unauthenticated", "Must be signed in.");

    const { uid, planId } = request.data as { uid?: string; planId?: string };

    if (!uid || uid !== callerUid) {
      throw new functions.HttpsError("permission-denied", "UID mismatch.");
    }
    if (!planId || !PAID_PLANS[planId]) {
      throw new functions.HttpsError("invalid-argument", "Invalid plan ID.");
    }

    const plan = PAID_PLANS[planId];

    try {
      const subDoc = await db.runTransaction(async tx => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) throw new functions.HttpsError("not-found", "User not found.");

        const userData = userSnap.data()!;
        const cashable: number = (userData.cashableBalance as number) ?? 0;

        if (cashable < plan.priceNC) {
          throw new functions.HttpsError("resource-exhausted", "INSUFFICIENT_CASHABLE_BALANCE");
        }

        // Idempotency + active-sub guard
        const existingSnap = await db
          .collection("subscriptions")
          .where("uid", "==", uid)
          .where("status", "not-in", ["expired", "cancelled"])
          .limit(1)
          .get();

        if (!existingSnap.empty) {
          const existingSub = existingSnap.docs[0].data();
          const end = (existingSub.currentPeriodEnd as Timestamp)?.toDate();
          if (end && end > new Date()) {
            throw new functions.HttpsError("already-exists", "ACTIVE_SUB_EXISTS");
          }
        }

        const ledgerEntryId = `sub_debit_${uid}_${Date.now()}`;
        const ledgerRef = db.collection("coinLedger").doc(uid).collection("entries").doc(ledgerEntryId);
        const ledgerSnap = await tx.get(ledgerRef);
        if (ledgerSnap.exists) throw new functions.HttpsError("already-exists", "DUPLICATE_LEDGER_ENTRY");

        const now = new Date();
        const periodEnd = new Date(now.getTime() + plan.durationDays * 86_400_000);
        const periodEndTs = Timestamp.fromDate(periodEnd);
        const nowTs = Timestamp.fromDate(now);
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
          createdAt: FieldValue.serverTimestamp(),
        });

        tx.set(subRef, {
          uid, plan: planId, status: "active", currency: "NC",
          amount: plan.priceNC,
          currentPeriodStart: nowTs, currentPeriodEnd: periodEndTs,
          cancelAtPeriodEnd: false,
          lastInvoiceId: `inv_${ledgerEntryId}`,
          source: "coins",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.set(invRef, {
          subId, uid, plan: planId,
          periodStart: nowTs, periodEnd: periodEndTs,
          amount: plan.priceNC, currency: "NC",
          paidAt: FieldValue.serverTimestamp(),
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
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Restore any previously paused Business listings
        await restoreBusinessListings(uid);

        return { subId, periodEnd: periodEnd.toISOString() };
      });

      return { ...subDoc, status: "active" };
    } catch (err: unknown) {
      if (err instanceof functions.HttpsError) throw err;
      logger.error("subscribeWithNCCallable error", err);
      throw new functions.HttpsError("internal", "Subscription failed. Please try again.");
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 2. activateTrialCallable — Server-side trial enrollment
// Input:  { uid: string }
// Output: { subId: string; periodEnd: string }
// ══════════════════════════════════════════════════════════════════════════════
export const activateTrialCallable = functions.onCall(
  { region: "asia-south1" },
  async (request: any) => {
    const callerUid: string = request.auth?.uid;
    if (!callerUid) throw new functions.HttpsError("unauthenticated", "Must be signed in.");

    const { uid } = request.data as { uid?: string };
    if (!uid || uid !== callerUid) {
      throw new functions.HttpsError("permission-denied", "UID mismatch.");
    }

    try {
      const result = await db.runTransaction(async tx => {
        const userRef = db.collection("users").doc(uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) throw new functions.HttpsError("not-found", "User not found.");

        const userData = userSnap.data()!;
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
        const periodEnd = new Date(now.getTime() + 30 * 86_400_000);
        const periodEndTs = Timestamp.fromDate(periodEnd);
        const nowTs = Timestamp.fromDate(now);
        const subId = `sub_${uid}_trial`;

        tx.set(db.collection("subscriptions").doc(subId), {
          uid, plan: "business_trial_v1", status: "trial", currency: "free",
          amount: 0,
          currentPeriodStart: nowTs, currentPeriodEnd: periodEndTs,
          cancelAtPeriodEnd: false, source: "trial",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.set(db.collection("subscriptionInvoices").doc(`inv_trial_${uid}`), {
          subId, uid, plan: "business_trial_v1",
          periodStart: nowTs, periodEnd: periodEndTs,
          amount: 0, currency: "free",
          paidAt: FieldValue.serverTimestamp(),
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
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { subId, periodEnd: periodEnd.toISOString() };
      });

      return result;
    } catch (err: unknown) {
      if (err instanceof functions.HttpsError) throw err;
      logger.error("activateTrialCallable error", err);
      throw new functions.HttpsError("internal", "Failed to activate trial.");
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 3. dailyRenewalSweep — Scheduled 02:00 IST daily
//
// Checks config/platformSettings.subscription.cronEnabled before running.
// Phases:
//   T-7, T-3, T-1 from trial end → renewal reminder notification
//   T+0 (expired today) → flip status=expired, pause listings
// ══════════════════════════════════════════════════════════════════════════════
export const dailyRenewalSweep = onSchedule(
  {
    schedule: "0 2 * * *",    // 02:00 UTC daily (IST = UTC+5:30 → use "20 20 * * *" for 02:00 IST if needed)
    timeZone: "Asia/Kolkata",
    region: "asia-south1",
    memory: "512MiB",
  },
  async () => {
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
    const gracePeriodDays: number = settings.subscription?.business?.gracePeriodDays
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
      const uid: string = sub.uid;
      const endTs = sub.currentPeriodEnd as Timestamp | undefined;
      if (!endTs) continue;

      const endDate = endTs.toDate();
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86_400_000);
      const isTrial = sub.plan === "business_trial_v1";

      // ── Reminder notifications (T-7, T-3, T-1) ───────────────────────────
      if ([7, 3, 1].includes(daysLeft)) {
        const title = isTrial
          ? `Free trial ends in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`
          : `Business subscription renews in ${daysLeft} day${daysLeft > 1 ? "s" : ""}`;
        const body = isTrial
          ? "Choose a plan to keep your listing live after the trial."
          : "Top up your wallet or renew your plan to keep your listing active.";

        await writeNotification(uid, title, body, "/profile/subscription").catch(e =>
          logger.warn("notification write failed", { uid, error: e })
        );
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
              updatedAt: FieldValue.serverTimestamp(),
            });
            await db.collection("users").doc(uid).update({
              "subscription.status": daysExpired >= gracePeriodDays - 1 ? "grace" : "past_due",
              updatedAt: FieldValue.serverTimestamp(),
            }).catch(() => {}); // user doc might not exist yet — ignore
          }
        } else {
          // Grace period over — expire and pause listings
          if (sub.status !== "expired") {
            await subDoc.ref.update({
              status: "expired",
              updatedAt: FieldValue.serverTimestamp(),
            });
            await db.collection("users").doc(uid).update({
              "subscription.status": "expired",
              updatedAt: FieldValue.serverTimestamp(),
            }).catch(() => {});

            await pauseBusinessListings(uid);

            await writeNotification(
              uid,
              "Business listing paused",
              "Your subscription expired. Renew to reactivate your listing.",
              "/profile/subscription"
            ).catch(e => logger.warn("notification write failed", { uid, error: e }));

            expired++;
          }
        }
      }
    }

    logger.info(`dailyRenewalSweep done. reminded=${reminded} expired=${expired}`);
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// 4. adminSubscriptionAction — HTTPS callable
// Input:  { action: 'comp'|'pause'|'force_cancel'; uid: string; planId?: string; reason?: string }
// Output: { success: boolean }
// ══════════════════════════════════════════════════════════════════════════════
export const adminSubscriptionAction = functions.onCall(
  { region: "asia-south1" },
  async (request: any) => {
    const callerUid: string = request.auth?.uid;
    if (!callerUid) throw new functions.HttpsError("unauthenticated", "Must be signed in.");

    // Verify caller is admin
    const adminSnap = await db.collection("users").doc(callerUid).get();
    if (!adminSnap.exists || adminSnap.data()?.role !== "admin") {
      throw new functions.HttpsError("permission-denied", "Admin only.");
    }

    const { action, uid, planId, reason } = request.data as {
      action?: string;
      uid?: string;
      planId?: string;
      reason?: string;
    };

    if (!uid || !action) throw new functions.HttpsError("invalid-argument", "uid and action required.");

    if (action === "comp") {
      if (!planId || !PAID_PLANS[planId]) {
        throw new functions.HttpsError("invalid-argument", "Valid planId required for comp.");
      }
      const plan = PAID_PLANS[planId];
      const now = new Date();
      const periodEnd = new Date(now.getTime() + plan.durationDays * 86_400_000);
      const periodEndTs = Timestamp.fromDate(periodEnd);
      const subId = `sub_${uid}_comp_${Date.now()}`;

      await db.runTransaction(async tx => {
        tx.set(db.collection("subscriptions").doc(subId), {
          uid, plan: planId, status: "comped", currency: "free",
          amount: 0,
          currentPeriodStart: Timestamp.fromDate(now),
          currentPeriodEnd: periodEndTs,
          cancelAtPeriodEnd: false, source: "comp",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(db.collection("users").doc(uid), {
          subscription: {
            status: "comped",
            currentPeriodEnd: periodEndTs,
            plan: planId,
            cancelAtPeriodEnd: false,
          },
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      await db.collection("auditLogs").add({
        action: "subscription_comp_granted",
        adminId: callerUid,
        adminName: adminSnap.data()?.displayName ?? "Admin",
        targetId: uid,
        details: reason ?? "Comp granted",
        metadata: { plan: planId, subId },
        createdAt: FieldValue.serverTimestamp(),
      });

      await writeNotification(
        uid,
        "ProNeighbor sponsored your listing 🎉",
        `You received a complimentary ${plan.label} Business listing plan.`,
        "/profile/subscription"
      );

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
        await existingSnap.docs[0].ref.update({ status: "paused", updatedAt: FieldValue.serverTimestamp() });
      }
      await db.collection("users").doc(uid).update({
        "subscription.status": "paused",
        updatedAt: FieldValue.serverTimestamp(),
      });
      await pauseBusinessListings(uid);
      await db.collection("auditLogs").add({
        action: "subscription_paused",
        adminId: callerUid,
        adminName: adminSnap.data()?.displayName ?? "Admin",
        targetId: uid,
        details: reason ?? "Admin pause",
        createdAt: FieldValue.serverTimestamp(),
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
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await db.collection("users").doc(uid).update({
        "subscription.status": "expired",
        updatedAt: FieldValue.serverTimestamp(),
      });
      await pauseBusinessListings(uid);
      await db.collection("auditLogs").add({
        action: "subscription_force_cancelled",
        adminId: callerUid,
        adminName: adminSnap.data()?.displayName ?? "Admin",
        targetId: uid,
        details: reason ?? "Admin force cancel",
        createdAt: FieldValue.serverTimestamp(),
      });
      return { success: true };
    }

    throw new functions.HttpsError("invalid-argument", `Unknown action: ${action}`);
  }
);
