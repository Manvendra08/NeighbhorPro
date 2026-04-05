import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
      // Strip PII from breadcrumbs
      if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb: Sentry.Breadcrumb) => ({
          ...breadcrumb,
          data:
            breadcrumb.data && typeof breadcrumb.data === "object"
              ? sanitize(breadcrumb.data as Record<string, unknown>)
              : breadcrumb.data,
        }));
      }
      return event;
    },
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (context) Sentry.setContext("extra", context);
  Sentry.captureException(error);
}

export function setUser(uid: string | null) {
  Sentry.setUser(uid ? { id: uid } : null);
}

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...data };
  for (const key of ["password", "token", "secret", "phone", "email"]) {
    if (key in redacted) redacted[key] = "[Redacted]";
  }
  return redacted;
}
