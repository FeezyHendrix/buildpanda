import assert from "node:assert/strict";
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const canonicalTools = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", "import { fieldToolDescriptor, fieldToolHandlers } from './src/modules/field-actions/tools.ts'; process.stdout.write(JSON.stringify(Object.keys(fieldToolHandlers).map(fieldToolDescriptor)));"], { cwd: fileURLToPath(new URL("../../backend", import.meta.url)), encoding: "utf8" });
assert.equal(canonicalTools.status, 0, canonicalTools.stderr);
const descriptors = JSON.parse(canonicalTools.stdout);
const PDFDocument = createRequire(new URL("../../backend/package.json", import.meta.url))("pdfkit");
const pdfBytes = await new Promise((resolve, reject) => {
  const doc = new PDFDocument(), chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk)); doc.on("error", reject); doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.text("BuildPanda authorized document fixture"); doc.end();
});
async function fillRich(label, value, index = 0) {
  const editor = page.getByRole("textbox", { name: label, exact: true }).nth(index);
  await editor.fill("");
  for (const [line, text] of value.split("\n").entries()) {
    if (line) await editor.press("Enter");
    if (text) await editor.pressSequentially(text);
  }
}

// Fixture transport verifies the real UI; backend persistence and live messaging delivery require integration tests. A second fixture adapter proves the UI has no WhatsApp-specific contract.
const url = process.env.PANDA_AGENT_TEST_URL || "http://127.0.0.1:5175";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.context().addCookies([{ name: "panda-fixture-session", value: "browser-fixture-only", url: new URL(url).origin }]);
page.setDefaultTimeout(10_000);
const errors = [];
const consoleErrors = [];
page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
page.on("console", (message) => {
  if (["error", "warning"].includes(message.type()) && !/Failed to load resource.*(?:401|403|409|503)/.test(message.text())) consoleErrors.push(message.text());
});
let authorized = true;
let userId = "user-a";
let linked = false;
let permissions = ["view", "create"];
let materialPermissions = [];
let missingSessionCapabilities = false;
let missingProposalCapabilities = false;
let allTools = false;
let readonlyDocument = false;
let unavailableTools = false;
let completeFileUpload;
const fileUploadGate = new Promise((resolve) => { completeFileUpload = resolve; });
let uploadedFiles = 0;
let uploadedMessages = 0;
let missingUploadCapability = false;
let documentViews = 0;
let documentDenied = false;
let documentMime = "application/pdf";
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
const template = { value: "template-safety", label: "Safety diary", fields: [
  { id: "safety", type: "section", label: "Safety", required: false, options: [], unit: null },
  { id: "ppe", type: "yes_no", label: "PPE used", required: true, options: [], unit: null },
  { id: "workers", type: "number", label: "Workers on site", required: true, options: [], unit: "people" },
  { id: "conditions", type: "select", label: "Conditions", required: true, options: ["Clear", "Rain"], unit: null },
  { id: "observations", type: "long_text", label: "Observations", required: false, options: [], unit: null },
] };

function capabilities() {
  if (readonlyDocument) return { capture: false, read: true, dailyLogCreate: false, materialReceipt: false, materialUsage: false, actions: Object.fromEntries(descriptors.map((tool) => [tool.kind, ["open_document", "download_document"].includes(tool.kind)])) };
  const dailyLogCreate = allTools || permissions.includes("create");
  const materialReceipt = allTools || materialPermissions.some((permission) => ["request", "manage"].includes(permission));
  const materialUsage = allTools || materialPermissions.includes("manage");
  return { capture: allTools || dailyLogCreate || materialReceipt || materialUsage, read: allTools || permissions.includes("view") || materialPermissions.includes("view"), dailyLogCreate, materialReceipt, materialUsage,
    actions: Object.fromEntries(descriptors.map((tool) => [tool.kind, allTools || (tool.kind === "daily_log" || tool.kind === "update_daily_log" ? dailyLogCreate : tool.kind === "material_log" ? materialReceipt || materialUsage : false)])) };
}

function proposalResponse(proposal) {
  if (missingProposalCapabilities) return { ...proposal, capabilities: undefined };
  const access = capabilities();
  const allowed = proposal.actions.every((action) => access.actions[action.kind] && (action.kind !== "material_log" || (action.payload.entryType === "IN" ? access.materialReceipt : action.payload.entryType === "USED" && access.materialUsage)));
  return { ...proposal, capabilities: { edit: allowed && proposal.actions.length > 0 && proposal.status === "draft", confirm: allowed && proposal.actions.length > 0 && !proposal.clarification && proposal.status === "draft", cancel: (access.capture || access.read) && proposal.status === "draft" } };
}

await page.route("**/*", async (route) => {
  const request = route.request();
  const address = new URL(request.url());
  const isSignIn = address.pathname.endsWith("/api/auth/sign-in/email");
  const isSignOut = address.pathname.endsWith("/api/auth/sign-out");
  const isFileUpload = address.pathname.endsWith("/files") && request.method() === "POST";
  const isDocumentView = address.pathname.endsWith("/projects/project-a/documents/document-a/versions/version-a/view");
  if (!address.pathname.includes("/messaging-agent/") && !isSignIn && !isSignOut && !isFileUpload && !isDocumentView) return address.origin === new URL(url).origin ? route.continue() : route.abort();
  const path = address.pathname.replace(/^\/api/, "");
  const payload = request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : null;
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
  if (isDocumentView) {
    assert.equal(request.method(), "GET");
    assert.ok((await request.allHeaders()).cookie?.includes("panda-fixture-session=browser-fixture-only"));
    documentViews += 1;
    if (documentDenied) return send({ error: "Your current access does not allow viewing this document." }, 403);
    return route.fulfill({ status: 200, contentType: documentMime, body: documentMime === "application/pdf" ? pdfBytes : "<script>window.unsafeArtifactExecuted=true</script>", headers: { "Content-Disposition": `inline; filename="${documentMime === "application/pdf" ? "Issued%20foundation.pdf" : "unsupported.html"}"` } });
  }
  if (isFileUpload) {
    const data = request.postData();
    assert.ok(data.indexOf('name="projectId"') < data.indexOf('name="file"'));
    assert.ok(data.includes("project-a") && data.includes("chosen.pdf") && data.includes("%PDF-fixture-upload"));
    uploadedFiles += 1;
    await fileUploadGate;
    return send({ id: "file-browser", fileName: "chosen.pdf", mimeType: "application/pdf", sizeBytes: 19, createdAt: linkedAt }, 201);
  }
  if (path.endsWith("/messages/upload") && request.method() === "POST") {
    const data = request.postData();
    assert.ok(data.indexOf('name="connectionId"') < data.indexOf('name="file"'));
    assert.ok(data.indexOf('name="text"') < data.indexOf('name="file"'));
    assert.ok(data.includes("connection-a") && data.includes("browser-plan.pdf") && data.includes("Use this issued foundation plan.") && data.includes("%PDF-"));
    uploadedMessages += 1;
    messages.push({ id: "browser-attachment", role: "user", text: "Use this issued foundation plan. · browser-plan.pdf", inputType: "attachment", status: "processed", createdAt: linkedAt }, { id: "attachment-question", role: "assistant", text: "I received the attached plan. What revision label should I use?", createdAt: linkedAt });
    return send({ messageId: "browser-attachment", file: { id: "file-ingress", fileName: "browser-plan.pdf", mimeType: "application/pdf", sizeBytes: pdfBytes.length, createdAt: linkedAt } });
  }
  if (path === "/messaging-agent/status") return send({ userId, enabled: configured, channels: configured ? channels : [], connections: connections(), projects });
  if (path.endsWith("/tools")) return send({ uploads: missingUploadCapability ? undefined : capabilities().capture, tools: unavailableTools ? [] : descriptors.filter((tool) => capabilities().actions[tool.kind]), targets: { buildings: buildings.map((building) => ({ value: building.id, label: building.name })), templates: [template], assignees: [{ value: "crew-a", label: "Crew A" }], teamMembers: [{ value: "inspection-team", label: "Inspection team" }] } });
  if (path === "/messaging-agent/link" && request.method() === "POST") {
    assert.equal(payload.projectId, "project-a");
    if (capabilities().materialReceipt && !capabilities().dailyLogCreate) {
      assert.equal(payload.buildingId, null); buildingId = null;
      return send({ code: "MATERIAL-LINK-CODE", expiresAt: new Date(Date.now() + 300_000).toISOString(), connectUrl: "https://wa.me/2348000000000?text=LINK%20MATERIAL-LINK-CODE" });
    }
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
    return send({ connectionId: wrongConnection ? "connection-wrong" : connectionId, projectId, organizationId: projectId === "project-a" ? "company-a" : "company-b", buildings: !allTools && !permissions.length && materialPermissions.length ? [] : buildings, buildingId: connection?.selectedScope?.projectId === projectId ? connection.selectedScope.buildingId : null, permissions: { dailyLog: permissions, materials: materialPermissions }, capabilities: missingSessionCapabilities ? undefined : capabilities(), messages: ownPrimary ? messages : otherMessages, proposals: ownPrimary ? proposals.map(proposalResponse) : [] });
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
    if (payload.text === "How much sand arrived?") {
      messages.push({ id: "read-question", role: "user", text: payload.text, createdAt: linkedAt, status: "processed" }, { id: "read-answer", role: "assistant", text: "The recorded receipt is 22.5 tonnes of sand.", createdAt: linkedAt });
      return send({ kind: "answer", answer: "The recorded receipt is 22.5 tonnes of sand." });
    }
    if (["The tanker has just arrived.", "Some sand came in too."].includes(payload.text)) {
      const question = payload.text === "The tanker has just arrived." ? "What did the tanker carry, and what quantity and unit arrived?" : "I still need the tanker contents and quantity. What quantity and unit of sand arrived?";
      proposals = [{ id: `clarification-${messages.length}`, version: 1, status: "draft", title: "Material details needed", summary: "No material movement has been saved.", clarification: question, createdAt: new Date().toISOString(), actions: [] }];
      messages.push({ id: `capture-${messages.length}`, role: "user", text: payload.text, createdAt: new Date().toISOString(), inputType: "text", status: "processed", retryable: false }, { id: `question-${messages.length}`, role: "assistant", text: question, createdAt: new Date().toISOString() });
      return send(proposalResponse(proposals[0]));
    }
    if (payload.text === "The tanker carried 5000 litres of water, and 20 tonnes of sand arrived.") {
      proposals = [{ id: "draft-a", version: 1, status: "draft", title: "Review 2 material movements", summary: payload.text, createdAt: new Date().toISOString(), actions: [
        { kind: "material_log", title: "Record water arrival", missing: [], payload: { entryType: "IN", materialName: "Water", quantity: 5000, unit: "litre", reason: "Expected last week.", notesHtml: "<p>Expected last week.</p>" } },
        { kind: "material_log", title: "Record sand arrival", missing: [], payload: { entryType: "IN", materialName: "Sand", quantity: 20, unit: "tonne" } },
      ] }];
      messages.push({ id: "material-complete", role: "user", text: payload.text, createdAt: new Date().toISOString(), status: "processed" });
      return send(proposalResponse(proposals[0]));
    }
    const header = payload.text === "Update the daily header.";
    const action = header
      ? { kind: "update_daily_log", title: "Update daily header", missing: [], payload: { summary: "Original daily summary.\nEight workers.", summaryHtml: "<p>Original daily summary.<br />Eight workers.</p>", workersPresent: 8, buildingId, logDate: "2026-11-14" } }
      : { kind: "daily_log", title: "Add site note", missing: [], payload: { bodyText: payload.text, bodyHtml: `<p>${payload.text}</p>`, buildingId, logDate: "2026-11-14" } };
    const draft = { id: "draft-a", version: 1, status: "draft", title: header ? "Daily header" : "Site note", summary: payload.text, createdAt: new Date().toISOString(), actions: [action] };
    proposals = [draft];
    messages = [{ id: "message-a", role: "user", text: payload.text, createdAt: new Date().toISOString(), inputType: "text" }];
    return send(proposalResponse(draft));
  }
  if (path.endsWith("/draft-a") && request.method() === "PATCH") {
    assert.equal(payload.version, proposals[0].version);
    if (payload.actions[0].kind === "material_log") {
      assert.equal(payload.actions.length, 2);
      assert.deepEqual(payload.actions.map((action) => [action.kind, action.payload.materialName, action.payload.quantity, action.payload.unit, action.payload.entryType]), [["material_log", "Water", 5000, "litre", "IN"], ["material_log", "Sand", 22.5, "tonne", "IN"]]);
      assert.equal(payload.actions[0].payload.reason, "Expected last week.\n\nActually received today.");
      assert.equal(payload.actions[0].payload.notesHtml, "<p>Expected last week.</p><p></p><p>Actually received today.</p>");
      for (const action of payload.actions) { assert.equal(action.payload.buildingId, undefined); assert.equal(action.payload.logDate, undefined); }
    } else if (payload.actions[0].kind === "update_daily_log") {
      assert.equal(payload.actions[0].payload.workersPresent, 10);
      assert.equal(payload.actions[0].payload.summaryHtml, payload.version === 1 ? "<p>Original daily summary.<br />Eight workers.</p>" : "<p>Updated &amp; verified summary.</p><p>No incidents.</p>");
    } else {
      assert.equal(payload.actions[0].payload.bodyText, "Ten workers completed the slab.");
      assert.equal(payload.actions[0].payload.bodyHtml, "<p>Ten workers completed the slab.</p>");
    }
    proposals[0] = { ...proposals[0], version: proposals[0].version + 1, actions: payload.actions.map((action) => ({ ...action, title: action.kind === "material_log" ? "Material movement" : "Add site note", missing: [] })) };
    return send(proposalResponse(proposals[0]));
  }
  if (path.endsWith("/generic-a") && request.method() === "PATCH") {
    assert.equal(payload.version, 1);
    assert.equal(payload.actions.length, 5);
    assert.equal(payload.actions[0].kind, "create_task");
    assert.deepEqual(payload.actions[0].payload, { title: "Inspect revised opening", description: "Check width.\n\nKeep the fire route clear.", descriptionHtml: "<p><strong>Check width.</strong></p><p>Keep the fire route clear.</p>", assignees: [{ kind: "user", id: "crew-a" }, { kind: "team", id: "inspection-team" }], labels: ["inspection", "fire route"], priority: "High" });
    assert.deepEqual(payload.actions[1], { kind: "resolve_drawing", payload: { markupId: "markup-a", resolved: false } });
    assert.deepEqual(payload.actions[2], { kind: "upload_document_version", payload: { documentId: "document-a", fileId: "file-browser", revisionLabel: "Rev B", notes: "Opening revised.\n\nIssued for site." } });
    assert.deepEqual(payload.actions[3], { kind: "daily_log", payload: { buildingId: "building-b", logDate: "2026-11-14", templateId: "template-safety", responses: { ppe: false, workers: 9, conditions: "Clear", observations: "First paragraph.\n\nSecond paragraph." } } });
    assert.deepEqual(payload.actions[4], { kind: "annotate_drawing", payload: { documentId: "document-a", documentVersionId: "version-a", pageNo: 2, kind: "pin", geometry: { kind: "pin", space: "percent", at: { x: 30, y: 40 } }, followUp: { kind: "rfi", payload: { subject: "Confirm opening width", question: "Please confirm the width.", questionHtml: "<p><strong>Please confirm the width.</strong></p>", costImpact: false, scheduleImpact: false } } } });
    proposals[0] = { ...proposals[0], version: 2, actions: payload.actions.map((action, index) => ({ ...action, title: proposals[0].actions[index].title, missing: [] })) };
    return send(proposalResponse(proposals[0]));
  }
  if (path.endsWith("/confirm")) {
    assert.equal(payload.version, proposals[0].version);
    if (failConfirm) return send({ error: "Draft changed. Refresh before confirming." }, 409);
    commits += 1;
    proposals[0] = { ...proposals[0], status: "completed", result: { recordId: "entry-a", message: proposals[0].actions[0]?.kind === "material_log" ? "2 material movements saved." : proposals[0].id === "readonly-document" ? "Document revision ready." : proposals[0].id === "generic-a" ? "5 field actions saved." : "Site note saved." } };
    return send(proposalResponse(proposals[0]));
  }
  if (path.endsWith("/cancel")) {
    cancels += 1;
    proposals[0] = { ...proposals[0], status: "cancelled" };
    return send(proposalResponse(proposals[0]));
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
  await fillRich("Diary note (optional)", "Ten workers completed the slab.");
  await page.getByRole("button", { name: "Save corrections" }).click();
  await page.getByRole("button", { name: "Confirm" }).waitFor();
  failConfirm = true;
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("alert").filter({ hasText: "Draft changed" }).waitFor();
  assert.equal(commits, 0);
  failConfirm = false;
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByText("Site note saved.", { exact: true }).waitFor();
  assert.equal(commits, 1);
  assert.equal(await page.getByRole("button", { name: "Confirm" }).count(), 0);
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
  await page.getByLabel(/^Workers present \(optional\)$/i).fill("10");
  await page.getByRole("button", { name: "Save corrections" }).click();
  await page.getByRole("button", { name: "Confirm" }).waitFor();
  await fillRich("Summary (optional)", "Updated & verified summary.\nNo incidents.");
  await page.getByRole("button", { name: "Save corrections" }).click();
  await page.getByRole("button", { name: "Confirm" }).waitFor();
  const plainDraft = structuredClone(proposals[0]);
  for (const payload of [{ ...plainDraft.actions[0].payload, fileId: "file-secret" }, { ...plainDraft.actions[0].payload, mysteryChoice: true }]) {
    proposals = [{ ...plainDraft, version: proposals[0].version + 1, actions: [{ ...plainDraft.actions[0], payload }] }];
    await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Unsupported field:" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Confirm" }).isDisabled(), true);
  }
  proposals = [{ ...plainDraft, version: proposals[0].version + 1, actions: [{ ...plainDraft.actions[0], payload: { ...plainDraft.actions[0].payload, summary: "Formatted summary", summaryHtml: "<p><strong>Formatted summary</strong></p>" } }] }];
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByRole("textbox", { name: "Summary (optional)", exact: true }).locator("strong").waitFor();
  assert.equal(await page.getByRole("button", { name: "Confirm" }).isDisabled(), false);
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

  userId = "material-crew"; permissions = []; materialPermissions = ["request"];
  proposals = []; messages = []; linked = false; buildingId = null; extraConnections = false; otherConnected = false;
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByRole("button", { name: "Connect WhatsApp", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Building", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Connect WhatsApp", exact: true }).isDisabled(), false);
  await page.getByRole("button", { name: "Connect WhatsApp", exact: true }).click();
  await page.getByText("LINK MATERIAL-LINK-CODE", { exact: true }).waitFor();
  linked = true;
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByText("WhatsApp connected", { exact: true }).waitFor();
  for (const text of ["The tanker has just arrived.", "Some sand came in too."]) {
    await page.getByLabel("Describe the site update").fill(text);
    await page.getByRole("button", { name: "Prepare review" }).click();
    await page.getByRole("heading", { name: "Material details needed" }).waitFor();
    await page.getByRole("status").filter({ hasText: text.startsWith("The tanker") ? "What did the tanker carry" : "I still need the tanker contents" }).first().waitFor();
    assert.equal(await page.getByRole("button", { name: "Confirm" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Retry message", exact: true }).count(), 0);
    assert.equal(await page.getByText("Could not process this message", { exact: true }).count(), 0);
  }
  await page.getByRole("button", { name: "Cancel draft", exact: true }).click();
  await page.getByText("Cancelled", { exact: true }).waitFor();
  assert.equal(await page.getByRole("status").filter({ hasText: "I still need the tanker contents" }).count(), 0);
  assert.equal(cancels, 2);
  await page.getByLabel("Describe the site update").fill("The tanker carried 5000 litres of water, and 20 tonnes of sand arrived.");
  await page.getByRole("button", { name: "Prepare review" }).click();
  await page.getByLabel("Material", { exact: true }).first().waitFor();
  assert.equal(await page.getByLabel("Work date", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Building", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Quantity", { exact: true }).first().inputValue(), "5000");
  assert.equal(await page.getByLabel("Unit", { exact: true }).first().inputValue(), "litre");
  missingProposalCapabilities = true;
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByRole("button", { name: "Confirm" }).waitFor({ state: "detached" });
  missingProposalCapabilities = false;
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByRole("button", { name: "Confirm" }).waitFor();
  await page.getByLabel("Quantity", { exact: true }).first().fill("0");
  assert.equal(await page.getByRole("button", { name: "Save corrections" }).isDisabled(), true);
  await page.getByLabel("Quantity", { exact: true }).first().fill("1e-8");
  assert.equal(await page.getByRole("button", { name: "Save corrections" }).isDisabled(), true);
  await page.getByLabel("Quantity", { exact: true }).first().fill("0.29");
  assert.equal(await page.getByRole("button", { name: "Save corrections" }).isDisabled(), false);
  await page.getByLabel("Quantity", { exact: true }).first().fill("5000");
  await page.getByLabel("Material", { exact: true }).first().fill("");
  assert.equal(await page.getByRole("button", { name: "Save corrections" }).isDisabled(), true);
  await page.getByLabel("Material", { exact: true }).first().fill("Water");
  await page.getByLabel("Unit", { exact: true }).first().fill("");
  assert.equal(await page.getByRole("button", { name: "Save corrections" }).isDisabled(), true);
  await page.getByLabel("Unit", { exact: true }).first().fill("litre");
  await page.getByLabel("Movement", { exact: true }).first().selectOption({ label: "USED" });
  await page.getByText("Your current access does not allow this action or movement.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Save corrections" }).isDisabled(), true);
  await page.getByLabel("Movement", { exact: true }).first().selectOption({ label: "IN" });
  await page.getByLabel("Quantity", { exact: true }).nth(1).fill("22.5");
  assert.equal(await page.getByRole("textbox", { name: "Notes (optional)", exact: true }).first().innerText(), "Expected last week.");
  await fillRich("Notes (optional)", "Expected last week.\n\nActually received today.");
  await page.getByRole("button", { name: "Save corrections" }).click();
  await page.getByRole("button", { name: "Confirm" }).waitFor();
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByText("2 material movements saved.", { exact: true }).waitFor();
  assert.equal(commits, 2);
  const materialReceipt = structuredClone(proposals[0]);
  allTools = true; buildingId = "building-b";
  proposals = [{ id: "all-schemas", version: 1, status: "draft", title: "Review every field tool", summary: "Typed control coverage for the canonical backend catalog.", createdAt: linkedAt, actions: descriptors.map((tool) => ({ kind: tool.kind, title: `Schema ${tool.kind}`, payload: {}, missing: ["Fixture facts required"] })) }];
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByText(`Schema ${descriptors.at(-1).kind}`, { exact: true }).waitFor();
  assert.ok(descriptors.length >= 52);
  assert.equal(await page.locator("legend").filter({ hasText: /^Schema / }).count(), descriptors.length);
  assert.equal(await page.getByText("This draft has unavailable action fields.", { exact: false }).count(), 0);
  assert.equal(await page.getByRole("alert").filter({ hasText: "Unsupported field:" }).count(), 0);
  proposals = [{ id: "generic-a", version: 1, status: "draft", title: "Review 5 field actions", summary: "Task, drawing, uploaded revision, diary form and linked RFI.", createdAt: linkedAt, actions: [
    { kind: "create_task", title: "Task inspection", missing: [], payload: { title: "Inspect opening", description: "Check width.\n\nKeep the fire route clear.", descriptionHtml: "<p><strong>Check width.</strong></p><p>Keep the fire route clear.</p>", assignees: [{ kind: "user", id: "crew-a" }, { kind: "team", id: "inspection-team" }], labels: ["inspection", "fire route"], priority: "High" } },
    { kind: "resolve_drawing", title: "Reopen the original pin", missing: [], payload: { markupId: "markup-a", resolved: false } },
    { kind: "upload_document_version", title: "Register revised plan", missing: [], payload: { documentId: "document-a", fileId: "file-existing", revisionLabel: "Rev B", notes: "Opening revised.\n\nIssued for site." } },
    { kind: "daily_log", title: "Complete safety form", missing: [], payload: { buildingId: "building-b", logDate: "2026-11-14", templateId: "template-safety", responses: { ppe: false, workers: 8, conditions: "Clear", observations: "First paragraph.\n\nSecond paragraph." } } },
    { kind: "annotate_drawing", title: "Create pin with RFI", missing: [], payload: { documentId: "document-a", documentVersionId: "version-a", pageNo: 2, kind: "pin", geometry: { kind: "pin", space: "percent", at: { x: 25, y: 40 } }, followUp: { kind: "rfi", payload: { subject: "Opening width", question: "Please confirm the width.", questionHtml: "<p><strong>Please confirm the width.</strong></p>", costImpact: false, scheduleImpact: false } } } },
  ] }];
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByRole("heading", { name: "Review 5 field actions", exact: true }).waitFor();
  unavailableTools = true;
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByText("This draft has unavailable action fields.", { exact: false }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Confirm" }).count(), 0);
  assert.equal(await page.getByLabel("Task", { exact: true }).count(), 0);
  unavailableTools = false;
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByLabel("Task", { exact: true }).fill("Inspect revised opening");
  const firstAssignee = page.getByRole("group", { name: "Assignees 1", exact: true });
  await firstAssignee.getByLabel("Kind", { exact: true }).selectOption({ label: "team" });
  assert.equal(await page.getByRole("button", { name: "Save corrections" }).isDisabled(), true);
  const idPicker = firstAssignee.locator("select").last();
  assert.deepEqual(await idPicker.locator("option").allTextContents(), ["Current selection (refresh to choose another)", "Inspection team"]);
  await idPicker.selectOption({ label: "Inspection team" });
  await firstAssignee.getByLabel("Kind", { exact: true }).selectOption({ label: "user" });
  assert.equal(await page.getByRole("button", { name: "Save corrections" }).isDisabled(), true);
  await idPicker.selectOption({ label: "Crew A" });
  await page.getByLabel("Resolved", { exact: true }).selectOption({ label: "Yes" });
  await page.getByLabel("Resolved", { exact: true }).selectOption({ label: "No" });
  await page.getByLabel("Safety · Workers on site (people)", { exact: true }).fill("9");
  await page.getByLabel("Subject", { exact: true }).fill("Confirm opening width");
  await page.getByLabel("X", { exact: true }).fill("30");
  missingUploadCapability = true;
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByRole("group", { name: "Register revised plan", exact: true }).locator('input[type="file"]').waitFor({ state: "detached" });
  assert.equal(await page.getByRole("button", { name: "Attach image", exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Attach a file", { exact: true }).count(), 0);
  missingUploadCapability = false;
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByRole("group", { name: "Register revised plan", exact: true }).locator('input[type="file"]').setInputFiles({ name: "chosen.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-fixture-upload") });
  await page.getByText("Uploading file. Wait before saving.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Save corrections" }).isDisabled(), true);
  completeFileUpload();
  await page.getByText("Uploading file. Wait before saving.", { exact: true }).waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Save corrections" }).click();
  await page.getByRole("button", { name: "Confirm" }).waitFor();
  assert.equal(uploadedFiles, 1);
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.getByText("5 field actions saved.", { exact: true }).waitFor();
  assert.equal(commits, 3);
  allTools = false; buildingId = null; readonlyDocument = true;
  proposals = [{ id: "readonly-document", version: 1, status: "draft", title: "Read-only document review", summary: "Open the authorized revision.", createdAt: linkedAt, actions: [{ kind: "open_document", title: "Open original revision", missing: [], payload: { documentId: "document-a", versionId: "version-a" } }] }];
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByRole("heading", { name: "Read-only document review", exact: true }).waitFor();
  const readConfirm = page.getByRole("button", { name: "Confirm", exact: true });
  assert.equal(await readConfirm.isDisabled(), false);
  await readConfirm.click();
  await page.getByText("Document revision ready.", { exact: true }).waitFor();
  assert.equal(commits, 4);
  readonlyDocument = false; proposals = [materialReceipt];
  materialPermissions = ["view"];
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByLabel("Attach a file", { exact: true }).waitFor({ state: "detached" });
  await page.getByText("2 material movements saved.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Confirm" }).count(), 0);
  await page.getByLabel("Describe the site update").fill("How much sand arrived?");
  await page.getByRole("button", { name: "Prepare review" }).click();
  await page.getByText("The recorded receipt is 22.5 tonnes of sand.", { exact: true }).waitFor();
  missingSessionCapabilities = true;
  await page.getByRole("button", { name: "Refresh conversation", exact: true }).click();
  await page.getByRole("heading", { name: "Site records are restricted" }).waitFor();
  assert.equal(await page.getByText("2 material movements saved.", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Describe the site update").count(), 0);
  missingSessionCapabilities = false; materialPermissions = []; buildingId = "building-b"; extraConnections = true;
  userId = "user-b";
  permissions = ["view"];
  proposals = [];
  messages = [{ id: "message-b", role: "user", text: "Read-only message.", createdAt: new Date().toISOString(), status: "failed", retryable: true }];
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByRole("heading", { name: "Your site conversation" }).waitFor();
  await page.getByText("All caught up", { exact: true }).waitFor();
  assert.equal(await page.getByText("Update the daily header.", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Voice note awaiting retry.", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Attach a file", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Describe the site update").count(), 1);
  assert.equal(await page.getByRole("button", { name: "Confirm" }).count(), 0);
  permissions = [];
  await page.reload();
  await page.getByRole("heading", { name: "Site records are restricted" }).waitFor();
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
  allTools = true;
  proposals = [{ id: "artifact-result", version: 1, status: "completed", title: "Authorized document result", summary: "Original drawing revision.", createdAt: linkedAt, actions: [{ kind: "open_document", title: "Open original revision", payload: { documentId: "document-a", versionId: "version-a" } }], artifacts: [{ kind: "document", projectId: "project-a", documentId: "document-a", versionId: "version-a", fileName: "Issued foundation.pdf", mimeType: "application/pdf", download: false, apiPath: "https://untrusted.test/ignored", url: "https://untrusted.test/ignored" }] }];
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByLabel("Attach a file", { exact: true }).waitFor();
  await page.getByLabel("Describe the site update").fill("Use this issued foundation plan.");
  await page.getByLabel("Attach a file", { exact: true }).setInputFiles({ name: "browser-plan.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await page.getByRole("button", { name: "Prepare review" }).click();
  await page.getByText("I received the attached plan. What revision label should I use?", { exact: true }).waitFor();
  await page.getByText("You · Attachment", { exact: true }).waitFor();
  assert.equal(uploadedMessages, 1);
  assert.equal(await page.getByLabel("Describe the site update").inputValue(), "");
  const artifact = page.getByRole("region", { name: "Issued foundation.pdf", exact: true });
  await artifact.getByRole("button", { name: "Preview document", exact: true }).click();
  await artifact.getByTitle("Issued foundation.pdf").waitFor();
  assert.match(await artifact.getByTitle("Issued foundation.pdf").getAttribute("src"), /^blob:/);
  const downloadEvent = page.waitForEvent("download");
  await artifact.getByRole("button", { name: "Download document", exact: true }).click();
  const downloaded = await downloadEvent;
  assert.equal(downloaded.suggestedFilename(), "Issued foundation.pdf");
  const downloadedBytes = [];
  for await (const chunk of await downloaded.createReadStream()) downloadedBytes.push(chunk);
  assert.deepEqual(Buffer.concat(downloadedBytes), pdfBytes);
  documentDenied = true;
  await artifact.getByRole("button", { name: "Preview document", exact: true }).click();
  await artifact.getByRole("alert").filter({ hasText: "does not allow viewing" }).waitFor();
  assert.equal(await artifact.locator("iframe,img").count(), 0);
  documentDenied = false;
  for (const mime of ["text/html", "image/svg+xml", "application/xml"]) {
    documentMime = mime;
    await artifact.getByRole("button", { name: "Preview document", exact: true }).click();
    await artifact.getByText("Preview is unavailable for this file type.", { exact: false }).waitFor();
    assert.equal(await artifact.locator("iframe,img").count(), 0);
    assert.equal(await page.evaluate(() => window.unsafeArtifactExecuted), undefined);
  }
  documentMime = "application/pdf"; proposals = [];
  const handoff = `${url}/?projectId=project-a&documentId=document-a&versionId=version-a`;
  await page.goto(handoff);
  await page.getByTitle("Issued foundation.pdf").waitFor();
  const viewsBeforeForeign = documentViews;
  await page.goto(`${url}/?projectId=foreign-project&documentId=document-a&versionId=version-a`);
  await page.getByRole("heading", { name: "Document link is unavailable", exact: true }).waitFor();
  assert.equal(documentViews, viewsBeforeForeign);
  authorized = false;
  await page.goto(handoff);
  await page.getByRole("heading", { name: "Sign in to connect your site", exact: true }).waitFor();
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(documentViews, viewsBeforeForeign);
  await page.getByLabel("Email", { exact: true }).fill("crew@example.test");
  await page.getByLabel("Password", { exact: true }).fill("Fixture-password-only-93");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByTitle("Issued foundation.pdf").waitFor();
  assert.equal(new URL(page.url()).searchParams.get("documentId"), "document-a");
  assert.equal(new URL(page.url()).searchParams.get("versionId"), "version-a");
  allTools = false; permissions = ["view"];
  await page.getByRole("button", { name: "Refresh account", exact: true }).click();
  await page.getByText("Document access is unavailable with your current project permissions.", { exact: true }).waitFor();
  assert.equal(await page.locator("iframe,img").count(), 0);
  await signOutButton.click();
  await page.getByRole("heading", { name: "Sign in to connect your site" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Your site conversation" }).count(), 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  console.log(`Passed: all ${descriptors.length} canonical tool schemas rendered; task/drawing/follow-up/document/diary-form edits preserve typed nested data and rich HTML; staged files, attachment ingress and upload gates; authenticated PDF bytes/preview/download, unsafe MIME blocking, handoff sign-in and revocation; read-only answers; denied/missing capabilities; material clarification/units; daily/header corrections; account/project/channel isolation; retries, cancellation and auth states; no browser console errors.`);
} catch (error) {
  console.error("Fixture browser state:", await page.locator("body").innerText());
  console.error("Browser errors:", errors);
  console.error("Browser console:", consoleErrors);
  throw error;
} finally {
  await browser.close();
}
