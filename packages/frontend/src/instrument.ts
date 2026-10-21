import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import * as Sentry from "@sentry/react";

// Sentry reports from production builds only, and only when a DSN is set. Both
// halves matter: vite's envDir is the repo root, so a DSN in the shared .env
// would otherwise follow every developer into `pnpm dev`. Leaving VITE_SENTRY_DSN
// unset on staging/preview keeps those deployments silent without a code change.
const dsn = import.meta.env.VITE_SENTRY_DSN ?? "";

export const sentryEnabled = import.meta.env.PROD && Boolean(dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "production",
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    integrations: [
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      // Replays are recorded against RBAC-scoped project, task and financial
      // data, so content is masked at capture time and never reaches Sentry.
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Wired only while Sentry is live so development keeps React's own console
// reporting for uncaught render errors.
export const sentryRootOptions = sentryEnabled
  ? {
      onUncaughtError: Sentry.reactErrorHandler(),
      onCaughtError: Sentry.reactErrorHandler(),
      onRecoverableError: Sentry.reactErrorHandler(),
    }
  : undefined;
