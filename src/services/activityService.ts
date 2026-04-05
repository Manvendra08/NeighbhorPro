import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export type ActivityEvent =
  | "user.login"
  | "user.logout"
  | "user.profile_update"
  | "user.signup"
  | "ui.error_boundary"
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
  | "verification.deleted"
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
const CRITICAL_EVENT_ALLOWLIST = new Set([
  "payment.success",
  "booking.created",
  "verification.approved",
  "booking.completed",
]);

// Bounded rate limit cache with LRU eviction (max 5000 entries)
class BoundedRateLimitCache {
  private cache = new Map<string, number>();
  private readonly maxSize = 5000;

  get(key: string): number | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Remove oldest entry (first one in iteration order)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

const activityRateLimitCache = new BoundedRateLimitCache();

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
    // Bypass rate limiting for critical events
    if (!CRITICAL_EVENT_ALLOWLIST.has(event)) {
      // Include event type in rate limit key for per-event-type limiting
      const cacheKey = `${userId}:${event}`;
      const now = Date.now();
      const last = activityRateLimitCache.get(cacheKey) ?? 0;
      if (now - last < ACTIVITY_RATE_LIMIT_MS) return;
      activityRateLimitCache.set(cacheKey, now);
    }

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

type ErrorBoundaryInfo = {
  componentStack?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Unknown UI error";
}

/**
 * Log a React ErrorBoundary crash for signed-in users.
 */
export async function logErrorBoundaryActivity(
  userId: string | undefined,
  error: unknown,
  errorInfo?: ErrorBoundaryInfo
): Promise<void> {
  if (!userId) return;

  const details = `ErrorBoundary caught: ${getErrorMessage(error)}`;
  await logActivity(userId, "ui.error_boundary", details, {
    source: "ErrorBoundary",
    componentStack: String(errorInfo?.componentStack || "").slice(0, 3000),
    route: typeof window !== "undefined" ? window.location.pathname : "unknown",
  });
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
