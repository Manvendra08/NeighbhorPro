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
import { initSentry } from "./lib/sentry";
import ErrorBoundary from "./components/ErrorBoundary";

initSentry();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
