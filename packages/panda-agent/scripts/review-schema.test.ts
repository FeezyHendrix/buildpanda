import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldToolDescriptor, fieldToolHandlers } from "../../backend/src/modules/field-actions/tools.ts";
import { allowedAction, reviewActionIssues, reviewIssues, reviewTool, sourcedHint, supportedSchema } from "../src/components/review-schema.ts";
import type { AgentSession } from "../src/api/agent.ts";
import type { ToolCatalog, ToolDescriptor } from "../src/api/tool-types.ts";

const tools = Object.keys(fieldToolHandlers).map((kind) => fieldToolDescriptor(kind as keyof typeof fieldToolHandlers)) as ToolDescriptor[];
const catalog: ToolCatalog = { tools };

test("every backend field-tool schema has a supported typed review control", () => {
  assert.ok(tools.length >= 52);
  for (const tool of tools) {
    assert.equal(supportedSchema(tool.schema), true, tool.kind);
    assert.ok(reviewTool({ kind: tool.kind, title: "Review", payload: {} }, catalog), tool.kind);
  }
  assert.equal(reviewTool({ kind: "unknown-future-action", title: "Review", payload: {} }, catalog), undefined);
  assert.equal(supportedSchema({ type: "object", additionalProperties: true }), false);
  assert.equal(supportedSchema({ type: "unrecognized-widget" }), false);
});

test("canonical client validation preserves nested arrays and rich mirrors and rejects coercion or dropped keys", () => {
  const schema = tools.find((tool) => tool.kind === "create_task")!.schema;
  const payload = { title: "Inspect opening", description: "Check width.\n\nKeep the fire route clear.", descriptionHtml: "<p><strong>Check width.</strong></p><p>Keep the fire route clear.</p>", assignees: [{ kind: "user", id: "crew" }, { kind: "team", id: "inspection-team" }], labels: ["inspection", "fire route"], priority: "High" };
  const before = structuredClone(payload);
  assert.deepEqual(reviewIssues(schema, payload), []);
  assert.deepEqual(payload, before);
  assert.ok(reviewIssues(schema, { ...payload, assignees: [{ kind: "user", id: 12 }] }).length);
  assert.ok(reviewIssues(schema, { ...payload, lostIntent: true }).length);
  const resolved = tools.find((tool) => tool.kind === "resolve_drawing")!.schema;
  assert.deepEqual(reviewIssues(resolved, { markupId: "drawing-pin", resolved: false }), []);
  assert.ok(reviewIssues(resolved, { markupId: "drawing-pin", resolved: "false" }).length);
  const material = tools.find((tool) => tool.kind === "material_log")!.schema;
  assert.deepEqual(reviewIssues(material, { entryType: "IN", materialName: "Sand", unit: "tonne", quantity: 0.29 }), []);
  assert.ok(reviewIssues(material, { entryType: "IN", materialName: "Sand", unit: "tonne", quantity: 0.001 }).length);
  assert.ok(reviewIssues(material, { entryType: "IN", materialName: "Sand", unit: "tonne", quantity: 1e-8 }).length);
  assert.ok(reviewIssues(material, { entryType: "IN", materialName: "Sand", unit: "tonne", quantity: 0.30000000000000004 }).length);
  const send = tools.find((tool) => tool.kind === "send_message")!.schema;
  const target: Record<string, unknown> = { projectGeneral: true, body: "Please check the pour." };
  assert.deepEqual(reviewIssues(send, target), []);
  target.channelId = "channel";
  assert.ok(reviewIssues(send, target).length, "General and an existing channel are exclusive targets");
  delete target.projectGeneral;
  assert.deepEqual(reviewIssues(send, target), [], "the optional General value can be removed to choose an existing channel");
});

test("daily form responses use the selected backend template's real question types and required fields", () => {
  const template = { value: "template-safety", label: "Safety diary", fields: [
    { id: "ppe", type: "yes_no", label: "PPE used", required: true, options: [] },
    { id: "workers", type: "number", label: "Workers", required: true, options: [] },
    { id: "observations", type: "long_text", label: "Observations", required: false, options: [] },
  ] };
  const payload = { buildingId: "building-a", logDate: "2026-11-16", templateId: template.value, responses: { ppe: false, workers: 8, observations: "First paragraph.\n\nSecond paragraph." } };
  const action = { kind: "daily_log", title: "Safety diary", payload };
  const withTemplate = { tools, targets: { templates: [template] } };
  const reviewed = reviewTool(action, withTemplate)!;
  assert.deepEqual(reviewIssues(reviewed.schema, payload), []);
  assert.ok(reviewIssues(reviewed.schema, { ...payload, responses: { ...payload.responses, ppe: "false" } }).length);
  assert.ok(reviewIssues(reviewed.schema, { ...payload, responses: { ...payload.responses, workers: undefined } }).length);
  assert.equal(reviewTool(action, { tools, targets: { templates: [] } }), undefined);
  assert.equal(reviewTool(action, { tools, targets: { templates: [{ ...template, fields: [{ id: "new", type: "unknown", label: "Unknown", required: true }] }] } }), undefined);
});

test("read-only document actions honor exact server action capabilities and deny missing ones", () => {
  const action = { kind: "open_document", title: "Open document", payload: { documentId: "document-a" } };
  const session = { capabilities: { capture: false, read: true, dailyLogCreate: false, materialReceipt: false, materialUsage: false, actions: { open_document: true } } } as AgentSession;
  assert.equal(allowedAction(action, session), true);
  assert.equal(allowedAction(action, { ...session, capabilities: { ...session.capabilities, actions: {} } }), false);
  assert.equal(allowedAction(action, { ...session, capabilities: { ...session.capabilities, actions: undefined } }), false);
});

test("typed assignee IDs use their sibling kind and reject mixing workspace users with roster members", () => {
  const task = tools.find((tool) => tool.kind === "create_task")!;
  const hint = task.fields.find((field) => field.name === "assignees[].id")!;
  assert.deepEqual(hint.sourceBy, { field: "kind", sources: { user: "assignees", team: "teamMembers" } });
  const targets = { tools, targets: { assignees: [{ value: "user-a", label: "Workspace user" }], teamMembers: [{ value: "team-a", label: "Roster member" }] } };
  assert.equal(sourcedHint(hint, { kind: "team" })?.source, "teamMembers");
  assert.deepEqual(reviewActionIssues(task, { title: "Inspect opening", assignees: [{ kind: "user", id: "user-a" }, { kind: "team", id: "team-a" }] }, targets), []);
  assert.ok(reviewActionIssues(task, { title: "Inspect opening", assignees: [{ kind: "user", id: "team-a" }] }, targets).some((issue) => issue.includes("must match")));
});
