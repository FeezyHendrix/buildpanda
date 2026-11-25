import "@/lib/error-reports/bootstrap";
import { reportFrontendError } from "@/lib/error-reports/client";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/api/query-client";
import { RealtimeProvider } from "@/lib/realtime";
import App from "@/App";
import "@/styles/index.css";

// PWA service worker: production builds only (dev has no built /assets/ and
// caching would fight HMR). Module scope runs once per page load; the guard
// keeps this idempotent even if the module were re-evaluated (perf rule A-1).
let didRegisterSw = false;
if (import.meta.env.PROD && "serviceWorker" in navigator && !didRegisterSw) {
  didRegisterSw = true;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: the app works without offline asset caching.
    });
  });
}

function reportReactError(
  error: unknown,
  info: { componentStack?: string },
  log: boolean,
) {
  reportFrontendError(error, {
    kind: "react",
    componentStack: info.componentStack,
  });
  if (log) console.error(error);
}

createRoot(document.getElementById("root")!, {
  onUncaughtError: (error, info) => reportReactError(error, info, true),
  // Caught errors are already logged by the ErrorBoundary.
  onCaughtError: (error, info) => reportReactError(error, info, false),
  onRecoverableError: (error, info) => reportReactError(error, info, true),
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <Suspense>
          <App />
        </Suspense>
      </RealtimeProvider>
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  </StrictMode>,
);
