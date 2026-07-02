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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <Suspense>
          <App />
        </Suspense>
      </RealtimeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
