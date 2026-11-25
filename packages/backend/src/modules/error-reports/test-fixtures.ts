import type { FrontendErrorInput } from "./types.ts";
export const browserReport = (): FrontendErrorInput => ({
  id: "frontend_event_123",
  name: "TypeError",
  message: "Could not save",
  stack:
    "TypeError: Could not save\n at submit (https://app.example.test/assets/page.js:12:34)",
  kind: "mutation",
  occurredAt: new Date().toISOString(),
  route: "/projects/prj_123/finances?token=private",
  sessionId: "browser_session_123",
  release: "commit123",
  browser: {
    userAgent: "Test Browser",
    language: "en",
    viewport: "390x844",
    online: true,
    visibility: "visible",
  },
  breadcrumbs: [
    {
      at: new Date().toISOString(),
      type: "action",
      description: "button: Save",
    },
  ],
});
