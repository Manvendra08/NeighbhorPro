import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from "firebase/firestore";
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
  timestamp: ReturnType<typeof serverTimestamp>;
}

/**
 * Log a user activity event to Firestore.
 * Fire-and-forget — never blocks the calling action.
 */
export async function logActivity(
  userId: string,
  event: ActivityEvent,
  details: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await addDoc(collection(db, "activityLogs"), {
      userId,
      event,
      details,
      metadata: metadata ?? {},
      timestamp: serverTimestamp(),
    });
  } catch {
    // Non-critical — silently swallow
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
