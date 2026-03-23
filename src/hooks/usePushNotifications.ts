import { useEffect, useState } from "react";
import { getMessagingInstance } from "../firebase";
import { getToken, onMessage } from "firebase/messaging";
import { saveFCMToken } from "../services/supportService";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

// Module-level guard: ensures the onMessage listener is registered only once,
// regardless of how many times requestPermission is called (e.g., across re-renders
// or component remounts). Without this, multiple listeners stack and fire duplicate notifications.
let messageListenerRegistered = false;

export function usePushNotifications(uid: string | undefined) {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (!uid || !VAPID_KEY) return;
    setPermission(Notification.permission);
  }, [uid]);

  const requestPermission = async () => {
    if (!uid || !VAPID_KEY) return;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return;

    const messaging = await getMessagingInstance();
    if (!messaging) return;

    try {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      await saveFCMToken(uid, token);

      // Register the foreground message handler only once per app session
      if (!messageListenerRegistered) {
        messageListenerRegistered = true;
        onMessage(messaging, payload => {
          const title = payload.notification?.title ?? "ProNeighbor";
          const body  = payload.notification?.body  ?? "";
          if (Notification.permission === "granted") new Notification(title, { body, icon: "/images/logo.png" });
        });
      }
    } catch (e) {
      console.warn("FCM token error:", e);
    }
  };

  return { permission, requestPermission };
}


