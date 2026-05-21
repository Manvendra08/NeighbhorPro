import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { db, getMessagingInstance } from "../firebase";
import { captureError } from "../lib/sentry";

/**
 * Request notification permission and register FCM token for the current user.
 * Saves the token to Firestore under users/{uid}.fcmToken.
 *
 * Uses /sw.js (the unified service worker) — NOT a separate firebase-messaging-sw.js.
 * Both SWs registering at scope "/" would conflict; the unified SW handles both
 * app-shell caching and FCM background messages.
 */
export async function registerPushNotifications(uid: string): Promise<boolean> {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn("[FCM] Not supported in this browser.");
      return false;
    }

    // Request permission (no-op if already granted)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[FCM] Notification permission denied.");
      return false;
    }

    // Wait for the unified SW to be ready — it handles both caching and FCM.
    // In dev, main.tsx unregisters SWs, so we register on-demand here.
    let swRegistration: ServiceWorkerRegistration;
    try {
      swRegistration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      // Wait until the SW is active before requesting the FCM token
      await navigator.serviceWorker.ready;
    } catch (swErr) {
      console.error("[FCM] Service worker registration failed:", swErr);
      captureError(swErr, { operation: "sw_register_for_fcm", uid });
      return false;
    }

    const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;
    if (!vapidKey || vapidKey.trim() === "" || vapidKey === "YOUR_VAPID_KEY_HERE") {
      console.warn("[FCM] VITE_FCM_VAPID_KEY is not configured. Push notifications disabled.");
      return false;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.warn("[FCM] Failed to get FCM token.");
      return false;
    }

    await saveFcmToken(uid, token);

    // FCM v9 modular SDK does not expose onTokenRefresh. Instead, call getToken()
    // on each app load — it returns the cached token if still valid, or a new one
    // if the previous token was rotated. The registration guard in usePushNotifications
    // (registeredRef) ensures this only runs once per session, not on every render.

    // Issue #6 fix: Removed console.log from production code
    return true;
  } catch (error) {
    // Issue #6 fix: Removed console.error, using captureError only
    captureError(error, { operation: "register_push_notifications", uid });
    return false;
  }
}

/** Persist FCM token to Firestore, with setDoc fallback if the doc doesn't exist yet. */
async function saveFcmToken(uid: string, token: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  try {
    await updateDoc(userRef, { fcmToken: token });
  } catch (updateError) {
    if (
      updateError instanceof Error &&
      updateError.message.includes("No document to update")
    ) {
      await setDoc(userRef, { fcmToken: token }, { merge: true });
    } else {
      throw updateError;
    }
  }
}

/**
 * Listen for foreground FCM messages.
 * Shows a browser Notification and calls the optional onNotification callback
 * so the in-app notification center can refresh its data.
 *
 * Returns an unsubscribe function.
 */
export function listenForForegroundMessages(
  onNotification?: (payload: unknown) => void
): () => void {
  let unsub: (() => void) | null = null;

  getMessagingInstance().then(messaging => {
    if (!messaging) return;

    unsub = onMessage(messaging, payload => {
      // Notify the app so it can re-fetch / update state
      if (onNotification) {
        onNotification(payload);
      }

      // Show a browser notification for foreground messages
      // (background messages are handled by the SW's onBackgroundMessage)
      if (
        Notification.permission === "granted" &&
        (payload as { notification?: { title?: string; body?: string } }).notification
      ) {
        const n = (payload as { notification: { title?: string; body?: string } }).notification;
        new Notification(n.title || "ProNeighbor", {
          body: n.body || "",
          icon: "/images/logo.png",
          badge: "/images/logo.png",
        });
      }
    });
  }).catch(err => {
    captureError(err, { operation: "listen_foreground_messages" });
  });

  return () => {
    if (unsub) unsub();
  };
}

/** Returns true if the browser supports notifications and permission is granted. */
export function isNotificationSupported(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

/** Returns true if the user has explicitly denied notification permission. */
export function isNotificationDenied(): boolean {
  return "Notification" in window && Notification.permission === "denied";
}
