import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

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

const ACTIVITY_RATE_LIMIT_MS = 2000;
const activityRateLimitCache = new Map<string, number>();

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
    const now = Date.now();
    const last = activityRateLimitCache.get(userId) ?? 0;
    if (now - last < ACTIVITY_RATE_LIMIT_MS) return;
    activityRateLimitCache.set(userId, now);

    await addDoc(collection(db, "activityLogs"), {
      userId,
      event,
      details: String(details || "").slice(0, 500),
      metadata: metadata ?? {},
      timestamp: serverTimestamp(),
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
