import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functionsClient } from "../firebase";

export type ActivityEvent =
  | "user.login"
  | "user.logout"
  | "user.profile_update"
  | "user.signup"
  | "booking.created"
  | "booking.cancelled"
  | "booking.completed"
  | "payment.initiated"
  | "payment.success"
  | "message.sent"
  | "review.submitted"
  | "wallet.topup"
  | "wallet.withdrawal"
  | "support.ticket_created"
  | "verification.submitted"
  | "verification.approved"
  | "admin.action";

export interface ActivityLog {
  id?: string;
  userId: string;
  event: ActivityEvent;
  details: string;
  metadata?: Record<string, unknown>;
  timestamp: any; // Using any for simplicity as it could be serverTimestamp or plain object
}

/**
 * Log a user activity event via secure Cloud Function.
 * Implements server-side rate limiting to prevent write abuse.
 */
export async function logActivity(
  userId: string,
  event: ActivityEvent,
  details: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const logFn = httpsCallable(functionsClient, "logActivityFunction");
    await logFn({
      userId,
      event,
      details,
      metadata: metadata ?? {},
    });
  } catch (err) {
    console.error("Activity logging failed:", err);
  }
}

/**
 * Fetch activity logs for a specific user, newest first.
 */
export async function getUserActivityLogs(
  userId: string,
  maxCount = 50
): Promise<ActivityLog[]> {
  const q = query(
    collection(db, "activityLogs"),
    where("userId", "==", userId),
    orderBy("timestamp", "desc"),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
}
