import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import Fastify from "fastify";
import { errorReportService } from "../src/modules/error-reports/service.ts";
import { createSlackTransport } from "../src/modules/error-reports/slack.ts";
import reportsRoutes from "../src/modules/error-reports/routes.ts";
import reportsPlugin from "../src/plugins/error-reports.ts";
import errorHandler from "../src/plugins/error-handler.ts";
import { ForbiddenError } from "../src/lib/errors.ts";
import type { ErrorReport } from "../src/modules/error-reports/types.ts";
const { createServer: createViteServer } = await import(
  new URL(
    "../../frontend/node_modules/vite/dist/node/index.js",
    import.meta.url,
  ).href
);
const reports: ErrorReport[] = [],
  notifications: unknown[] = [],
  bodies: unknown[] = [];
const slack = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  notifications.push(JSON.parse(Buffer.concat(chunks).toString()));
  response.end("ok");
});
await new Promise<void>((resolve) => slack.listen(0, "127.0.0.1", resolve));
const slackPort = (slack.address() as { port: number }).port;
const send = createSlackTransport({
  webhookUrl: "https://hooks.slack.com/services/TEST/TEST/local-test-only",
  fetch: async (_url, init) => fetch(`http://127.0.0.1:${slackPort}`, init),
});
const service = errorReportService({
  enabled: true,
  environment: "browser-test",
  release: "qa123",
  record: (report) => reports.push(report),
  enqueue: async (report) => {
    await send(report);
  },
  onFailure: (code) => {
    throw new Error(code);
  },
});
const app = Fastify({ logger: false, forceCloseConnections: true });
await app.register(reportsPlugin, {
  capture: (error, context) => service.capture(error, context),
});
await app.register(errorHandler);
app.addHook("onRequest", async (request) => {
  request.user = {
    id: "qa_user",
    name: "Private name",
    email: "private@example.test",
    image: null,
    role: "user",
    emailVerified: true,
  };
  request.orgRoles = new Map([["qa_org", "member"]]);
  request.activeOrganizationId = "qa_org";
});
app.addHook("preHandler", async (request) => {
  if (request.routeOptions.url === "/error-reports") bodies.push(request.body);
});
const origins: string[] = [];
await app.register(reportsRoutes, { service, origins });
app.post("/qa/fail", async () => {
  throw new Error("Backend fixture failed");
});
app.get("/qa/denied", async () => {
  throw new ForbiddenError("Denied fixture");
});
await app.listen({ port: 0, host: "127.0.0.1" });
const apiPort = (app.server.address() as { port: number }).port;
process.env["VITE_API_BASE_URL"] = "/api";
process.env["VITE_ERROR_SINK_ENABLED"] = "true";
process.env["VITE_APP_RELEASE"] = "qa123";
const vite = await createViteServer({
  root: fileURLToPath(new URL("../../frontend", import.meta.url)),
  configFile: fileURLToPath(
    new URL("../../frontend/vite.config.ts", import.meta.url),
  ),
  server: {
    port: 0,
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api/, ""),
      },
    },
  },
  logLevel: "warn",
});
await vite.listen();
const uiPort = (vite.httpServer!.address() as { port: number }).port,
  origin = `http://127.0.0.1:${uiPort}`;
origins.push(origin);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const browserErrors: string[] = [];
page.on("pageerror", (error: Error) => browserErrors.push(error.message));
async function until(assertion: () => boolean, message: string) {
  const end = Date.now() + 45_000;
  while (!assertion() && Date.now() < end)
    await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(
    assertion(),
    `${message}: ${JSON.stringify(reports.map((r) => ({ source: r.source, kind: r.kind, message: r.message })))}`,
  );
}
try {
  await page.goto(`${origin}/error-sink-fixture.html`);
  await page.getByText("Ready", { exact: true }).waitFor();
  for (const button of [
    "Failed API",
    "Runtime",
    "Rejection",
    "Query",
    "Mutation",
    "Console",
    "React crash",
    "Failed fetch",
    "Repeat",
    "Broken resource",
    "Structured console",
  ]) {
    await page.getByRole("button", { name: button, exact: true }).click();
  }
  await page.getByRole("alert").waitFor();
  await until(
    () =>
      [
        "http",
        "runtime",
        "rejection",
        "query",
        "mutation",
        "console",
        "react",
        "resource",
      ].every((kind) =>
        reports.some((r) => r.source === "frontend" && r.kind === kind),
      ),
    "Every browser error source reached the backend",
  );
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  await until(
    () =>
      reports.some(
        (r) =>
          r.source === "frontend" &&
          r.message === "Repeated fixture failure" &&
          r.count > 1,
      ) &&
      reports.some(
        (r) =>
          r.source === "frontend" &&
          r.client?.request?.path.endsWith("/qa/denied"),
      ),
    "Page-exit batch flushes queued errors and repeat counts",
  );
  await service.flush();
  const http = reports.find(
    (r) => r.source === "frontend" && r.client?.request?.path === "/qa/fail",
  )!;
  assert.equal(http.client?.release, "qa123");
  assert.equal(http.context.userId, "qa_user");
  assert.equal(http.client?.browser.viewport, "390x844");
  assert.ok(http.context.requestId);
  assert.ok(
    reports.some(
      (r) =>
        r.source === "backend" &&
        r.context.requestId === http.context.requestId,
    ),
  );
  assert.ok(
    http.client?.breadcrumbs.some(
      (crumb) =>
        crumb.type === "action" && crumb.description.includes("Save fixture"),
    ),
  );
  assert.ok(reports.find((report) => report.source === "frontend" && report.kind === "react")?.context.componentStack?.includes("CrashedView"));
  await until(() => reports.some((report) => report.source === "frontend" && report.message === "Structured fixture failure"), "Structured console errors reach the sink without arbitrary fields");
  const encoded = JSON.stringify({ reports, notifications, bodies });
  for (const secret of [
    "PRIVATE_HTTP_QUERY",
    "PRIVATE_BODY_PASSWORD",
    "PRIVATE_RUNTIME_PASSWORD",
    "PRIVATE_RUNTIME_QUERY",
    "PRIVATE_CONSOLE_TOKEN",
    "PRIVATE_FETCH_QUERY",
    "PRIVATE_RESOURCE_DATA",
    "PRIVATE_STRUCTURED_PASSWORD",
    "private@example.test",
  ])
    assert.ok(
      !encoded.includes(secret),
      `${secret} left the browser or reached Slack`,
    );
  assert.ok(notifications.length >= 7);
  const first = bodies[0] as Record<string, unknown>;
  const bytes = await page.evaluate(
    (report: Record<string, unknown>) =>
      (window as unknown as { sizeTest: (value: unknown) => number }).sizeTest({
        ...report,
        message: "文".repeat(2000),
        stack: "文".repeat(12000),
        componentStack: "文".repeat(6000),
        breadcrumbs: new Array(30).fill({
          at: new Date().toISOString(),
          type: "action",
          description: "文".repeat(300),
        }),
      }),
    first,
  );
  assert.ok(bytes <= 45000);
  assert.ok(
    browserErrors.some((message) =>
      message.includes("PRIVATE_RUNTIME_PASSWORD"),
    ),
  );
  await writeFile(
    join(tmpdir(), "error-sink-browser-results.json"),
    JSON.stringify(
      {
        reports: reports.map((r) => ({
          id: r.id,
          source: r.source,
          kind: r.kind,
          requestId: r.context.requestId,
          release: r.client?.release,
        })),
        notifications: notifications.length,
        largestReportBytes: bytes,
        expectedBrowserErrors: browserErrors.length,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: true,
      frontendReports: reports.filter((r) => r.source === "frontend").length,
      backendReports: reports.filter((r) => r.source === "backend").length,
      slackNotifications: notifications.length,
      largestReportBytes: bytes,
    }),
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  slack.closeAllConnections();
  await new Promise<void>((resolve) => slack.close(() => resolve()));
}
