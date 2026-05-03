import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { db, getMessagingInstance } from "../firebase";
import { captureError } from "../lib/sentry";

/**
 * Request notification permission and register FCM token for the current user.
 * Saves the token to Firestore under users/{uid}/fcmToken
 */
export async function registerPushNotifications(uid: string): Promise<boolean> {
  try {
    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn("FCM not supported in this browser.");
      return false;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied.");
      return false;
    }

    // Register service worker explicitly
    const swRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });

    // Get FCM token
    const vapidKey = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;
    if (!vapidKey || vapidKey.trim() === "" || vapidKey === "YOUR_VAPID_KEY_HERE") {
      console.warn("VITE_FCM_VAPID_KEY is not configured. Push notifications disabled.");
      return false;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.warn("Failed to get FCM token.");
      return false;
    }

    // Save token to Firestore
    const userRef = doc(db, "users", uid);
    const updatePayload = { fcmToken: token };
    console.log("FCM update payload:", updatePayload, "for uid:", uid, "token length:", token.length);
    try {
      await updateDoc(userRef, updatePayload);
    } catch (updateError) {
      // Fallback: if update fails (e.g., doc doesn't exist), try setDoc with merge
      if (updateError instanceof Error && updateError.message.includes("No document to update")) {
        console.warn("User doc not found, attempting setDoc with merge...");
        await setDoc(userRef, updatePayload, { merge: true });
      } else {
        throw updateError;
      }
    }

    console.log("FCM token registered successfully.");
    return true;
  } catch (error) {
    console.error("Error registering push notifications:", error);
    captureError(error, { operation: "register_push_notifications", uid });
    return false;
  }
}

/**
 * Listen for foreground messages and display them as browser notifications.
 * Returns an unsubscribe function.
 */
export function listenForForegroundMessages(onNotification?: (payload: any) => void): () => void {
  let unsub: (() => void) | null = null;

  getMessagingInstance().then(messaging => {
    if (!messaging) return;
    
    unsub = onMessage(messaging, (payload) => {
      console.log("Foreground message received:", payload);
      
      if (onNotification) {
        onNotification(payload);
      }

      // Show browser notification for foreground messages
      if (Notification.permission === "granted" && payload.notification) {
        new Notification(payload.notification.title || "ProNeighbor", {
          body: payload.notification.body || "",
          icon: "/images/logo.png",
          badge: "/images/logo.png",
          data: payload.data,
        });
      }
    });
  });

  return () => {
    if (unsub) unsub();
  };
}

/**
 * Check if notifications are supported and permission is granted.
 */
export function isNotificationSupported(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

/**
 * Check if notification permission is denied.
 */
export function isNotificationDenied(): boolean {
  return "Notification" in window && Notification.permission === "denied";
}
