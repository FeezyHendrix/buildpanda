import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const port = Number(process.env.TELEGRAM_TEST_PORT || 5195);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [join(dirname(require.resolve("vite/package.json")), "bin/vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: new URL("..", import.meta.url), stdio: "pipe" });
let output = "";
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error" && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
const code = "a".repeat(32), botUrl = `https://t.me/buildpanda_bot?start=${code}`;
let allowed = true, enabled = true, linked = false, projectAllowed = true, multiple = false, delayed = false, failLink = false, invalidLink = false, unknownAccess = false, denyLink = false;
let statusCalls = 0, links = [], releaseLink, releaseAccess;
const access = () => ({ relationship: "guest", orgRole: null, permissions: allowed ? { project: ["view"], buildings: ["view"], dailyLog: ["create"] } : {}, sections: null, capabilities: {} });
await page.route("**/*", async (route) => {
  const request = route.request(), url = new URL(request.url());
  const json = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data), headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" } });
  if (url.hostname === "t.me") return route.fulfill({ contentType: "text/html", body: "<button>Start</button>" });
  if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" } });
  if (url.pathname.endsWith("/api/auth/get-session")) return json({ user: { id: "crew", name: "Crew", email: "crew@example.test" }, session: { id: "session", userId: "crew", activeOrganizationId: "org", expiresAt: "2099-01-01T00:00:00Z" } });
  if (url.pathname.endsWith("/auth/payload-key")) return json({}, 404);
  if (url.pathname.endsWith("/access")) {
    if (unknownAccess) await new Promise((resolve) => { releaseAccess = resolve; });
    return json(access());
  }
  if (url.pathname.endsWith("/buildings")) return json([{ id: "block", name: "Block A", kind: "real" }, ...(multiple ? [{ id: "block-b", name: "Block B", kind: "real" }] : [])]);
  if (url.pathname.endsWith("/messaging-agent/status")) {
    statusCalls++;
    return json({ userId: "crew", enabled, projects: projectAllowed ? [{ id: "site", organizationId: "org" }, { id: "other", organizationId: "org" }] : [],
      channels: [{ id: "telegram", accountId: "bot", enabled }], connections: linked ? [{ id: "connection", channel: "telegram", accountId: "bot", selectedScope: { projectId: "site", buildingId: "block" } }] : [] });
  }
  if (url.pathname.endsWith("/messaging-agent/link")) {
    links.push(request.postDataJSON());
    if (delayed) await new Promise((resolve) => { releaseLink = resolve; });
    if (denyLink) { allowed = false; return json({ message: "Project permission was revoked" }, 403); }
    return failLink ? json({ message: "Connection service unavailable" }, 503) : json({ code, expiresAt: new Date(Date.now() + 600_000).toISOString(), connectUrl: invalidLink ? "https://attacker.test" : botUrl });
  }
  if (url.origin !== origin) return json({});
  return route.continue();
});
async function open() { await page.goto(`${origin}/scripts/telegram-fixture.html`); }
async function refresh() { await page.getByRole("button", { name: "Refresh fixture" }).click(); }
const button = () => page.getByRole("button", { name: "Connect Telegram", exact: true });
const card = () => page.getByLabel("Telegram connection", { exact: true });
try {
  for (let tries = 0; tries < 100; tries++) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(origin)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  unknownAccess = true;
  await open();
  for (let tries = 0; !releaseAccess && tries < 100; tries++) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(releaseAccess); assert.equal(statusCalls, 0); assert.equal(await card().count(), 0);
  unknownAccess = false; releaseAccess(); await button().waitFor();
  assert.equal(await page.getByLabel("Telegram building").count(), 0);
  await button().click(); await page.waitForURL(botUrl);
  assert.deepEqual(links[0], { channel: "telegram", accountId: "bot", projectId: "site", buildingId: "block" });
  assert.equal(await page.getByRole("button", { name: "Start" }).count(), 1);
  linked = true; await open(); await card().getByText("Connected", { exact: true }).waitFor();
  assert.equal(await button().count(), 0);
  await page.getByRole("button", { name: "Switch project" }).click(); await button().waitFor();
  assert.equal(await card().getByText("Connected", { exact: true }).count(), 0);
  await card().getByText("Connecting switches this Telegram account to this project and cancels its pending reviews.", { exact: true }).waitFor();
  linked = false; multiple = true; await open();
  await page.getByLabel("Telegram building").waitFor(); assert.equal(await button().isDisabled(), true);
  await page.getByLabel("Telegram building").selectOption("block-b");
  await button().click(); await page.waitForURL(botUrl);
  assert.equal(links.at(-1).buildingId, "block-b");
  multiple = false; failLink = true; await open(); await button().click();
  await page.getByRole("alert").waitFor(); assert.equal(new URL(page.url()).origin, origin);
  failLink = false; invalidLink = true; await button().click(); await page.getByRole("alert").filter({ hasText: "invalid connection link" }).waitFor();
  assert.equal(new URL(page.url()).origin, origin); invalidLink = false;
  delayed = true; releaseLink = undefined; await button().click();
  for (let tries = 0; !releaseLink && tries < 100; tries++) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(releaseLink); await page.getByRole("button", { name: "Switch project" }).click();
  await card().getByText("Connect once to send text and voice reports for Other site.", { exact: true }).waitFor();
  releaseLink(); delayed = false; await page.waitForTimeout(200); assert.equal(new URL(page.url()).origin, origin);
  await open(); await button().waitFor(); releaseLink = undefined;
  delayed = true; await button().click();
  await page.waitForResponse((response) => response.url().endsWith("/messaging-agent/status"));
  for (let tries = 0; !releaseLink && tries < 100; tries++) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(releaseLink);
  allowed = false; await refresh(); await card().waitFor({ state: "hidden" });
  releaseLink(); delayed = false; await page.waitForTimeout(200); assert.equal(new URL(page.url()).origin, origin);
  const deniedCalls = statusCalls; await open(); await page.waitForTimeout(300);
  assert.equal(await card().count(), 0); assert.equal(statusCalls, deniedCalls);
  allowed = true; projectAllowed = false; await open(); await page.waitForTimeout(300); assert.equal(await card().count(), 0);
  projectAllowed = true; enabled = false; await open(); await page.waitForTimeout(300); assert.equal(await card().count(), 0);
  enabled = true; await open(); await button().waitFor();
  await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: false }); window.dispatchEvent(new Event("offline")); });
  await card().waitFor({ state: "hidden" });
  const offlineCalls = statusCalls; await page.waitForTimeout(200); assert.equal(statusCalls, offlineCalls);
  await page.evaluate(() => { Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); window.dispatchEvent(new Event("online")); });
  await button().waitFor();
  denyLink = true; await button().click(); await card().waitFor({ state: "hidden" });
  assert.equal(new URL(page.url()).origin, origin);
  assert.deepEqual(errors, []);
  console.log("Passed: phone-sized two-tap handoff, server-confirmed connection, building selection, project changes during linking, link failures, unsafe links, permission revocation during linking, unknown/denied access, server-denied links, disabled channel and offline/reconnect.");
} catch (error) { console.error(output); console.error(errors); console.error(await page.locator("body").innerText()); throw error; }
finally { await browser.close(); server.kill("SIGTERM"); }
