import { useCallback, useEffect, useRef, useState } from "react";
import {
  registerPushNotifications,
  listenForForegroundMessages,
  isNotificationDenied,
} from "../services/notificationService";

/**
 * Manages FCM push notification permission and token registration.
 *
 * - Reads the current browser permission on mount and whenever the
 *   visibilitychange event fires (catches the case where the user grants
 *   permission via the browser's own settings and then returns to the tab).
 * - Auto-registers when permission is already "granted" (e.g. returning user).
 * - Exposes requestPermission() for the "Enable Push" button.
 * - Calls onForegroundMessage whenever a foreground FCM message arrives so
 *   callers can trigger a data refresh.
 */
export function usePushNotifications(
  uid?: string,
  onForegroundMessage?: () => void
) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    () => {
      if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
      return Notification.permission;
    }
  );

  // Re-read the browser permission whenever the tab regains focus.
  // This catches the case where the user grants/denies via browser settings
  // while the tab is in the background.
  useEffect(() => {
    if (!("Notification" in window)) return;

    const syncPermission = () => {
      setPermission(Notification.permission);
    };

    document.addEventListener("visibilitychange", syncPermission);
    window.addEventListener("focus", syncPermission);
    return () => {
      document.removeEventListener("visibilitychange", syncPermission);
      window.removeEventListener("focus", syncPermission);
    };
  }, []);

  // Track whether we've already registered in this session to avoid
  // redundant Firestore writes on every re-render.
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!uid || permission !== "granted") return;
    if (registeredRef.current) return;

    let unsubForeground: (() => void) | null = null;

    const init = async () => {
      const success = await registerPushNotifications(uid);
      if (success) {
        registeredRef.current = true;
        unsubForeground = listenForForegroundMessages(onForegroundMessage);
      }
    };

    void init();

    return () => {
      if (unsubForeground) unsubForeground();
    };
    // onForegroundMessage intentionally excluded — it's a callback ref pattern;
    // callers should memoize it with useCallback if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, permission]);

  // Reset the registration guard when the user changes (logout → login).
  useEffect(() => {
    registeredRef.current = false;
  }, [uid]);

  const requestPermission = useCallback(async () => {
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
  }, [uid]);

  return { permission, requestPermission };
}
