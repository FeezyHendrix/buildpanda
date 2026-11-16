import assert from "node:assert/strict";
import { chromium } from "playwright";

// Fixture transport verifies the real UI; backend persistence and live messaging delivery require integration tests. A second fixture adapter proves the UI has no WhatsApp-specific contract.
const url = process.env.PANDA_AGENT_TEST_URL || "http://127.0.0.1:5175";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(10_000);
const errors = [];
const consoleErrors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type()) && !/Failed to load resource.*(?:401|403|409|503)/.test(message.text())) consoleErrors.push(message.text());
});
let authorized = true;
let userId = "user-a";
let linked = false;
let permissions = ["view", "create"];
let buildingId = null;
let activeProjectId = "project-a";
let proposals = [];
let messages = [];
let commits = 0;
let cancels = 0;
let failConfirm = false;
let scopeChanges = 0;
let retries = 0;
let extraConnections = false;
let otherConnected = false;
let wrongConnection = false;
let configured = true;
let signInMode = "rejected";
let signInRequests = 0;
let statusRequests = 0;
let failSignOut = true;
let signOutRequests = 0;
let completeSignOut;
const signOutGate = new Promise((resolve) => { completeSignOut = resolve; });
let completeSignIn;
const signInGate = new Promise((resolve) => { completeSignIn = resolve; });
const channels = [{ id: "whatsapp", label: "WhatsApp", accountId: "number-a", enabled: true }, { id: "fixture", label: "Other messenger", accountId: "bot-a", enabled: true }, { id: "whatsapp", label: "WhatsApp secondary", accountId: "number-b", enabled: true }];
const linkedAt = "2026-11-14T12:00:00.000Z";
const connections = () => [
  ...(linked ? [{ id: "connection-a", channel: "whatsapp", accountId: "number-a", channelLabel: "WhatsApp", linkedAt, selectedScope: { projectId: activeProjectId, buildingId } }] : []),
  ...(extraConnections ? [{ id: "connection-a2", channel: "whatsapp", accountId: "number-a", channelLabel: "WhatsApp", linkedAt: "2026-11-15T12:00:00.000Z", selectedScope: { projectId: "project-a", buildingId: "building-a" } }] : []),
  ...(extraConnections ? [{ id: "connection-c", channel: "whatsapp", accountId: "number-b", channelLabel: "WhatsApp secondary", linkedAt, selectedScope: { projectId: "project-a", buildingId: "building-a" } }] : []),
  ...(otherConnected ? [{ id: "connection-b", channel: "fixture", accountId: "bot-a", channelLabel: "Other messenger", linkedAt, selectedScope: { projectId: "project-a", buildingId: "building-a" } }] : []),
];
const projects = [{ id: "project-a", name: "Riverside", organizationId: "company-a" }, { id: "project-b", name: "Other company", organizationId: "company-b" }];
const buildings = [{ id: "building-a", name: "Block A" }, { id: "building-b", name: "Block B" }];

await page.route("**/*", async (route) => {
  const request = route.request();
  const address = new URL(request.url());
  const isSignIn = address.pathname.endsWith("/api/auth/sign-in/email");
  const isSignOut = address.pathname.endsWith("/api/auth/sign-out");
  if (!address.pathname.includes("/messaging-agent/") && !isSignIn && !isSignOut) return address.origin === new URL(url).origin ? route.continue() : route.abort();
  const path = address.pathname.replace(/^\/api/, "");
  const payload = request.postDataJSON();
  const send = (data, status = 200) => route.fulfill({
    status, contentType: "application/json", body: status === 204 ? "" : JSON.stringify(data),
    headers: { "Access-Control-Allow-Origin": new URL(url).origin, "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Headers": "content-type" },
  });
  if (request.method() === "OPTIONS") return send(null, 204);
  if (isSignOut) {
    assert.equal(request.method(), "POST"); assert.deepEqual(payload, {});
    signOutRequests += 1;
    if (failSignOut) return send({ message: "Fixture sign-out unavailable" }, 503);
    await signOutGate; authorized = false; return send({ success: true });
  }
  if (isSignIn) {
    assert.equal(request.method(), "POST");
    assert.deepEqual(payload, { email: "crew@example.test", password: "Fixture-password-only-93" });
    signInRequests += 1;
    if (signInMode === "rejected") return send({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid credentials" }, 401);
    if (signInMode === "verification") return send({ code: "EMAIL_NOT_VERIFIED", message: "Email verification required" }, 403);
    if (signInMode === "success") { await signInGate; authorized = true; }
    return send({ redirect: false, user: { id: userId } });
  }
  if (path === "/messaging-agent/status") statusRequests += 1;
  if (!authorized) return send({ error: "Sign in required" }, 401);
  if (path === "/messaging-agent/status") return send({ userId, enabled: configured, channels: configured ? channels : [], connections: connections(), projects });
  if (path === "/messaging-agent/link" && request.method() === "POST") {
    assert.equal(payload.projectId, "project-a");
    assert.equal(payload.buildingId, "building-b");
    if (payload.channel === "fixture") {
      assert.equal(payload.accountId, "bot-a");
      return send({ code: "OTHER-LINK-CODE", expiresAt: new Date(Date.now() + 300_000).toISOString(), connectUrl: null });
    }
    assert.equal(payload.channel, "whatsapp"); assert.equal(payload.accountId, "number-a");
    buildingId = payload.buildingId;
    return send({ code: "TEST-LINK-CODE", expiresAt: new Date(Date.now() + 300_000).toISOString(), connectUrl: "https://wa.me/2348000000000?text=LINK%20TEST-LINK-CODE" });
  }
  if (path.endsWith("/session")) {
    const projectId = path.split("/")[3];
    const connectionId = address.searchParams.get("connectionId");
    const connection = connections().find((item) => item.id === connectionId);
    const ownPrimary = connectionId === "connection-a" && projectId === "project-a";
    const source = { "connection-b": "Other channel private source.", "connection-c": "Other account private source.", "connection-a2": "Other connection private source." }[connectionId];
    const otherMessages = connection && source ? [{ id: connectionId + "-message", role: "user", text: source, createdAt: linkedAt }] : [];
    if (source) await new Promise((resolve) => setTimeout(resolve, 200));
    return send({ connectionId: wrongConnection ? "connection-wrong" : connectionId, projectId, organizationId: projectId === "project-a" ? "company-a" : "company-b", buildings, buildingId: connection?.selectedScope?.projectId === projectId ? connection.selectedScope.buildingId : null, permissions: { dailyLog: permissions }, messages: ownPrimary ? messages : otherMessages, proposals: ownPrimary ? proposals : [] });
  }
  if (path.endsWith("/scope")) {
    assert.equal(payload.connectionId, "connection-a");
    scopeChanges += 1;
    activeProjectId = path.split("/")[3];
    buildingId = payload.buildingId;
    return send({});
  }
  if (path.startsWith("/messaging-agent/connections/") && request.method() === "DELETE") {
    assert.equal(path, "/messaging-agent/connections/connection-b"); otherConnected = false; return send(null, 204);
  }
  if (path.endsWith("/messages/message-a/retry")) {
    assert.equal(request.method(), "POST");
    assert.equal(request.postData(), null);
    retries += 1;
    messages[0] = { ...messages[0], status: "processing", retryable: false };
    return send(null, 204);
  }
  if (path.endsWith("/proposals") && request.method() === "POST") {
    assert.equal(payload.connectionId, "connection-a");
    const header = payload.text === "Update the daily header.";
    const action = header
      ? { kind: "update_daily_log", title: "Update daily header", missing: [], payload: { summary: "Original daily summary.\nEight workers.", summaryHtml: "<p>Original daily summary.<br />Eight workers.</p>", workersPresent: 8, buildingId, logDate: "2026-11-14" } }
      : { kind: "daily_log", title: "Add site note", missing: [], payload: { bodyText: payload.text, bodyHtml: `<p>${payload.text}</p>`, buildingId, logDate: "2026-11-14" } };
    const draft = { id: "draft-a", version: 1, status: "draft", title: header ? "Daily header" : "Site note", summary: payload.text, createdAt: new Date().toISOString(), actions: [action] };
    proposals = [draft];
    messages = [{ id: "message-a", role: "user", text: payload.text, createdAt: new Date().toISOString(), inputType: "text" }];
    return send(draft);
  }
  if (path.endsWith("/draft-a") && request.method() === "PATCH") {
    assert.equal(payload.version, proposals[0].version);
    if (payload.actions[0].kind === "update_daily_log") {
      assert.equal(payload.actions[0].payload.workersPresent, 10);
      assert.equal(payload.actions[0].payload.summaryHtml, payload.version === 1 ? "<p>Original daily summary.<br />Eight workers.</p>" : "<p>Updated &amp; verified summary.<br>No incidents.</p>");
    } else {
      assert.equal(payload.actions[0].payload.bodyText, "Ten workers completed the slab.");
      assert.equal(payload.actions[0].payload.bodyHtml, "<p>Ten workers completed the slab.</p>");
    }
    proposals[0] = { ...proposals[0], version: proposals[0].version + 1, actions: payload.actions.map((action) => ({ ...action, title: "Add site note", missing: [] })) };
    return send(proposals[0]);
  }
  if (path.endsWith("/confirm")) {
    assert.equal(payload.version, proposals[0].version);
    if (failConfirm) return send({ error: "Draft changed. Refresh before confirming." }, 409);
    commits += 1;
    proposals[0] = { ...proposals[0], status: "completed", result: { recordId: "entry-a", message: "Site note saved." } };
    return send(proposals[0]);
  }
  if (path.endsWith("/cancel")) {
    cancels += 1;
    proposals[0] = { ...proposals[0], status: "cancelled" };
    return send(proposals[0]);
  }
  return send({ error: `Unexpected fixture request: ${request.method()} ${path}` }, 400);
});

try {
  await page.goto(url);
  await page.getByLabel("Project", { exact: true }).waitFor();
  await page.getByLabel("Messaging app", { exact: true }).selectOption("fixture:bot-a");
  await page.getByLabel("Building", { exact: true }).selectOption("building-b");
  await page.getByRole("button", { name: "Connect Other messenger", exact: true }).click();
  await page.getByText("LINK OTHER-LINK-CODE", { exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Open Other messenger", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Prepare review" }).isDisabled(), true);
  await page.getByLabel("Messaging app", { exact: true }).selectOption("whatsapp:number-a");
  await page.getByLabel("Building", { exact: true }).selectOption("building-b");
  assert.equal(scopeChanges, 0);
  await page.getByRole("button", { name: "Connect WhatsApp", exact: true }).click();
  await page.getByText("LINK TEST-LINK-CODE", { exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Open WhatsApp", exact: true }).getAttribute("href"), "https://wa.me/2348000000000?text=LINK%20TEST-LINK-CODE");
  linked = true;
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByText("WhatsApp connected", { exact: true }).waitFor();
  await page.getByLabel("Describe the site update").fill("Eight workers completed the slab.");
  await page.getByRole("button", { name: "Prepare review" }).click();
  await page.getByLabel("Site note", { exact: true }).fill("Ten workers completed the slab.");
  await page.getByRole("button", { name: "Save corrections" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).waitFor();
  failConfirm = true;
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await page.getByRole("alert").filter({ hasText: "Draft changed" }).waitFor();
  assert.equal(commits, 0);
  failConfirm = false;
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await page.getByText("Site note saved.", { exact: true }).waitFor();
  assert.equal(commits, 1);
  assert.equal(await page.getByRole("button", { name: "Confirm and save" }).count(), 0);
  await page.getByLabel("Project", { exact: true }).selectOption("project-b");
  await page.getByText("Your messages for this project will appear here.").waitFor();
  assert.equal(await page.getByText("Site note saved.", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Prepare review" }).isDisabled(), true);
  await page.getByLabel("Building", { exact: true }).selectOption("building-b");
  await page.getByLabel("Project", { exact: true }).selectOption("project-a");
  await page.getByLabel("Building", { exact: true }).selectOption("building-b");
  await page.getByLabel("Describe the site update").fill("A draft to cancel.");
  await page.getByRole("button", { name: "Prepare review" }).click();
  await page.getByRole("button", { name: "Cancel draft" }).click();
  await page.getByText("Cancelled", { exact: true }).waitFor();
  assert.equal(cancels, 1);
  await page.getByLabel("Describe the site update").fill("Update the daily header.");
  await page.getByRole("button", { name: "Prepare review" }).click();
  await page.getByLabel("Workers present", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save corrections" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).waitFor();
  await page.getByLabel("Daily summary", { exact: true }).fill("Updated & verified summary.\nNo incidents.");
  await page.getByRole("button", { name: "Save corrections" }).click();
  await page.getByRole("button", { name: "Confirm and save" }).waitFor();
  const plainDraft = structuredClone(proposals[0]);
  for (const payload of [{ ...plainDraft.actions[0].payload, fileId: "file-secret" }, { ...plainDraft.actions[0].payload, mysteryChoice: true }, { ...plainDraft.actions[0].payload, summaryHtml: "<p><strong>Hidden formatting</strong></p>" }]) {
    proposals = [{ ...plainDraft, version: proposals[0].version + 1, actions: [{ ...plainDraft.actions[0], payload }] }];
    await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
    await page.getByText("This draft contains fields, files or formatting that need the BuildPanda app. Continue there to review all details.").waitFor();
    assert.equal(await page.getByRole("button", { name: "Confirm and save" }).count(), 0);
  }
  messages = [{ id: "message-a", role: "user", text: "Voice note awaiting retry.", createdAt: new Date().toISOString(), inputType: "audio", status: "failed", retryable: true }];
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByRole("button", { name: "Retry message", exact: true }).click();
  await page.getByText("Preparing response", { exact: true }).waitFor();
  assert.equal(retries, 1);
  assert.equal(await page.getByRole("button", { name: "Retry message", exact: true }).count(), 0);
  extraConnections = true; otherConnected = true;
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByLabel("Connection", { exact: true }).selectOption("connection-a2");
  assert.equal(await page.getByText("Voice note awaiting retry.", { exact: true }).count(), 0);
  await page.getByText("Other connection private source.", { exact: true }).waitFor();
  assert.equal(await page.getByText("Voice note awaiting retry.", { exact: true }).count(), 0);
  await page.getByLabel("Messaging app", { exact: true }).selectOption("whatsapp:number-b");
  assert.equal(await page.getByText("Other connection private source.", { exact: true }).count(), 0);
  await page.getByText("Other account private source.", { exact: true }).waitFor();
  await page.getByLabel("Messaging app", { exact: true }).selectOption("fixture:bot-a");
  assert.equal(await page.getByText("Other account private source.", { exact: true }).count(), 0);
  await page.getByText("Other channel private source.", { exact: true }).waitFor();
  assert.equal(await page.getByText("Other connection private source.", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Voice note awaiting retry.", { exact: true }).count(), 0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Disconnect account", exact: true }).click();
  await page.getByRole("button", { name: "Connect Other messenger", exact: true }).waitFor();
  assert.equal(linked, true);
  await page.getByLabel("Messaging app", { exact: true }).selectOption("whatsapp:number-a");
  await page.getByLabel("Connection", { exact: true }).selectOption("connection-a");
  await page.getByText("Voice note awaiting retry.", { exact: true }).waitFor();
  wrongConnection = true;
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByRole("heading", { name: "Project access is unavailable", exact: true }).waitFor();
  assert.equal(await page.getByText("Voice note awaiting retry.", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Prepare review" }).count(), 0);
  wrongConnection = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByText("Voice note awaiting retry.", { exact: true }).waitFor();
  userId = "user-b";
  permissions = ["view"];
  proposals = [];
  messages = [{ id: "message-b", role: "user", text: "Read-only message.", createdAt: new Date().toISOString(), status: "failed", retryable: true }];
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByRole("heading", { name: "Your site conversation" }).waitFor();
  await page.getByText("All caught up", { exact: true }).waitFor();
  assert.equal(await page.getByText("Update the daily header.", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Voice note awaiting retry.", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Retry message", exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Describe the site update").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Confirm and save" }).count(), 0);
  permissions = [];
  await page.reload();
  await page.getByRole("heading", { name: "Daily logs are restricted" }).waitFor();
  assert.equal(await page.getByText("A draft to cancel.", { exact: true }).count(), 0);
  configured = false;
  await page.reload();
  await page.getByRole("heading", { name: "Messaging capture is not available yet", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Your site conversation", exact: true }).count(), 0);
  authorized = false;
  await page.reload();
  await page.getByRole("heading", { name: "Sign in to connect your site" }).waitFor();
  await page.getByRole("link", { name: "Open BuildPanda for account help" }).waitFor();
  assert.equal(await page.getByLabel("Email", { exact: true }).getAttribute("autocomplete"), "username");
  assert.equal(await page.getByLabel("Password", { exact: true }).getAttribute("autocomplete"), "current-password");
  await page.getByLabel("Email", { exact: true }).fill("crew@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-password-only-93");
  const signInButton = page.getByRole("button", { name: "Sign in", exact: true });
  for (const mode of ["rejected", "verification"]) {
    signInMode = mode;
    await signInButton.click();
    await page.getByRole("alert").filter({ hasText: "We could not sign you in" }).waitFor();
    assert.equal(await page.getByLabel("Project", { exact: true }).count(), 0);
    assert.equal(await page.getByRole("heading", { name: "Your site conversation", exact: true }).count(), 0);
  }
  signInMode = "no-session";
  await signInButton.click();
  await page.getByRole("alert").filter({ hasText: "Your sign-in session could not be verified" }).waitFor();
  assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), "");
  assert.equal(await page.getByLabel("Project", { exact: true }).count(), 0);
  configured = true;
  permissions = ["view", "create"];
  signInMode = "success";
  await page.getByLabel("Password", { exact: true }).fill("Fixture-password-only-93");
  const beforeSignInStatus = statusRequests;
  await signInButton.click();
  await page.locator("form button[type='submit'][aria-busy='true']").waitFor();
  assert.equal(await signInButton.isDisabled(), true);
  assert.equal(await signInButton.getAttribute("aria-busy"), "true");
  assert.equal(await page.getByLabel("Email", { exact: true }).isDisabled(), true);
  assert.equal(await page.getByLabel("Password", { exact: true }).isDisabled(), true);
  completeSignIn();
  await page.getByLabel("Project", { exact: true }).waitFor();
  assert.ok(statusRequests > beforeSignInStatus);
  assert.equal(signInRequests, 4);
  assert.equal(await page.getByRole("heading", { name: "Sign in to connect your site" }).count(), 0);
  await page.getByLabel("Messaging app", { exact: true }).selectOption("whatsapp:number-b");
  await page.getByText("Other account private source.", { exact: true }).waitFor();
  const signOutButton = page.getByRole("button", { name: "Sign out", exact: true });
  await signOutButton.click();
  await page.getByRole("alert").filter({ hasText: "We could not sign you out" }).waitFor();
  await page.getByText("Other account private source.", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Messaging app", { exact: true }).inputValue(), "whatsapp:number-b");
  failSignOut = false;
  await signOutButton.click();
  await page.locator("button[aria-busy='true']").filter({ hasText: "Sign out" }).waitFor();
  assert.equal(await signOutButton.isDisabled(), true);
  assert.equal(await page.getByText("Other account private source.", { exact: true }).count(), 0);
  completeSignOut();
  await page.getByRole("heading", { name: "Sign in to connect your site" }).waitFor();
  assert.equal(await page.getByLabel("Project", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Other account private source.", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), "");
  assert.equal(signOutRequests, 2);
  userId = "user-c";
  messages = [{ id: "message-c", role: "user", text: "New account private source.", createdAt: new Date().toISOString() }];
  await page.getByLabel("Email", { exact: true }).fill("crew@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-password-only-93");
  await signInButton.click();
  await page.getByText("New account private source.", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Messaging app", { exact: true }).inputValue(), "whatsapp:number-a");
  assert.equal(await page.getByText("Other account private source.", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Read-only message.", { exact: true }).count(), 0);
  await signOutButton.click();
  await page.getByRole("heading", { name: "Sign in to connect your site" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Your site conversation" }).count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  console.log("Passed: channel/account/connection selection and isolation, null connection URLs, connection-scoped unlink, mismatched session rejection, linking, versioned corrections and HTML preservation, failed confirmation, safe message retry, receipts, project/account isolation, unsupported-payload blocking, cancellation, denied/read-only access, direct sign-in with rejected/verification/missing-session/pending/success states, sign-out failure/success, account switching, and browser console checks.");
} catch (error) {
  console.error("Fixture browser state:", await page.locator("body").innerText());
  console.error("Browser errors:", errors);
  console.error("Browser console:", consoleErrors);
  throw error;
} finally {
  await browser.close();
}
