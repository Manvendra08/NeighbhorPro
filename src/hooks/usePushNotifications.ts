import { useEffect, useState } from "react";
import { registerPushNotifications, listenForForegroundMessages, isNotificationDenied } from "../services/notificationService";

export function usePushNotifications(uid?: string) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!uid || permission !== "granted") return;

    let unsubForeground: (() => void) | null = null;

    const init = async () => {
      const success = await registerPushNotifications(uid);
      if (success) {
        // Listen for foreground messages
        unsubForeground = listenForForegroundMessages();
      }
    };

    init();

    return () => {
      if (unsubForeground) unsubForeground();
    };
  }, [uid, permission]);

  const requestPermission = async () => {
    if (!uid) return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const success = await registerPushNotifications(uid);
    if (success) {
      setPermission("granted");
    } else if (isNotificationDenied()) {
      setPermission("denied");
    }
  };

  return {
    permission,
    requestPermission,
  };
}
