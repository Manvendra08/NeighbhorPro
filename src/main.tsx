import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import "./responsive.css";
import "./mobile.css";
import "./pwa.css";
import "./darkmode.css";
import App from "./App.tsx";
import { queryClient } from "./lib/queryClient";
import { captureError, initSentry } from "./lib/sentry";
import ErrorBoundary from "./components/ErrorBoundary";

initSentry();

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        captureError(err, { operation: "service_worker_register" });
      });
    });
  }
  // In dev, we intentionally skip pre-registering the SW to avoid stale cache
  // issues during hot-reload. The SW is registered on-demand by
  // notificationService.ts when the user enables push notifications.
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
