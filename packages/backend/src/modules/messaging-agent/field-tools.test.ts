import assert from "node:assert/strict";
import { test } from "node:test";
import { voiceActions, type VoiceActionKind } from "@buildpanda/voice-actions";
import { fieldToolDescriptor, fieldToolHandlers } from "../field-actions/tools.ts";
import { draftDailyActions } from "./draft.ts";
import { MessagingAnswerResult, MessagingClarificationError } from "./draft-errors.ts";
import { mayReadAnswer } from "./read-access.ts";
import type { MessagingAccess } from "./management-types.ts";

const day = "2026-11-16", id = "target-a";
const samples = {
  daily_log: { logDate: day, buildingId: id, bodyText: "Slab complete" }, update_daily_log: { logDate: day, buildingId: id, workersPresent: 8 },
  void_daily_log_entry: { entryId: id, reason: "Duplicate" }, material_log: { entryType: "IN", materialName: "Sand", quantity: 10, unit: "tonne" },
  void_ledger_entry: { entryId: id, reason: "Duplicate" }, material_order: { title: "Cement", materialName: "Cement", quantity: 2, unit: "bag", neededBy: day },
  update_material_order: { orderId: id, patch: { quantity: 3 } }, delete_material_order: { orderId: id }, receive_material_order: { orderId: id, deliveredQty: 2, deliveredAt: day, unit: "bag" },
  create_material_approval: { title: "Concrete", materialName: "Concrete" }, update_material_approval: { approvalId: id, title: "Concrete review" },
  decide_material_approval: { approvalId: id, status: "Approved", response: "Matches specification" }, reopen_material_approval: { approvalId: id }, delete_material_approval: { approvalId: id }, comment_material_approval: { approvalId: id, body: "Reviewed" },
  create_expense: { title: "Fuel", category: "materials", amount: 1500, currency: "NGN", transactedAt: day },
  rfi: { subject: "Door width", question: "Please confirm the opening width" }, update_rfi: { rfiId: id, patch: { subject: "Door opening" } }, transition_rfi: { rfiId: id, status: "Closed" }, comment_rfi: { rfiId: id, body: "Checked" }, respond_rfi: { rfiId: id, body: "Use 1200 mm", official: false },
  change_request: { title: "Additional lintel" }, update_change_request: { changeRequestId: id, patch: { costImpact: 1500, timeImpactDays: 2 } }, delete_change_request: { changeRequestId: id }, comment_change_request: { changeRequestId: id, body: "Reviewed" },
  look_ahead: { name: "Next week", startDate: day, endDate: "2026-11-23" }, update_look_ahead: { lookAheadId: id, patch: { name: "Next fortnight" } }, delete_look_ahead: { lookAheadId: id }, log_activity: { activityId: id, hoursLogged: 4, logDate: day }, transition_stage: { stageId: id, status: "InProgress" },
  create_task: { title: "Inspect slab" }, update_task: { taskId: id, title: "Inspect slab before pour" }, move_task: { taskId: id, columnId: id }, delete_task: { taskId: id }, comment_task: { taskId: id, body: "Complete" },
  send_message: { channelId: id, body: "Site meeting at 2 pm" }, send_direct_message: { userId: id, body: "Please review" }, reply_message: { messageId: id, body: "Confirmed" },
  create_project_update: { category: "Progress", title: "Slab", description: "Slab complete" }, edit_project_update: { updateId: id, title: "Slab complete" }, delete_project_update: { updateId: id }, comment_project_update: { updateId: id, body: "Checked" },
  upload_document: { fileId: id }, rename_document: { documentId: id, fileName: "Plan A.pdf" }, upload_document_version: { documentId: id, fileId: id }, download_document: { documentId: id, versionId: id }, open_document: { documentId: id }, delete_document: { documentId: id },
  annotate_drawing: { documentId: id, documentVersionId: id, pageNo: 1, kind: "pin", geometry: { kind: "pin", at: { x: 0.3, y: 0.4 } } }, comment_drawing: { markupId: id, body: "Check this detail" }, resolve_drawing: { markupId: id, resolved: true }, delete_drawing: { markupId: id },
} satisfies Record<VoiceActionKind, Record<string, unknown>>;
const scope = { projectId: "site", organizationId: "company", buildingId: id, tools: Object.keys(voiceActions).map((kind) => fieldToolDescriptor(kind as VoiceActionKind)), targets: { records: [{ id }] } };

test("every mobile action reaches text/translated-voice review with the canonical payload intact", async () => {
  assert.deepEqual(Object.keys(fieldToolHandlers).filter((kind) => Object.hasOwn(voiceActions, kind)).sort(), Object.keys(samples).sort());
  assert.ok(fieldToolHandlers.raise_activity_delay);
  for (const [kind, payload] of Object.entries(samples)) {
    const [action] = await draftDailyActions(`Requested ${kind}`, scope, [], async () => ({ actions: [{ kind, payload }], unresolved: [] }));
    assert.equal(action?.kind, kind);
    for (const [field, value] of Object.entries(payload)) assert.deepEqual(action!.payload[field], value, `${kind}.${field}`);
  }
});

test("read questions use authorized tools and never become writes or ungrounded answers", async () => {
  const calls: string[] = [];
  let turn = 0;
  await assert.rejects(draftDailyActions("How much sand is on hand?", { ...scope, reads: [{ name: "get_material_stock", description: "Stock", parameters: {} }], runRead: async (name) => { calls.push(name); return { material: "Sand", onHand: 12, unit: "tonne" }; } }, [], async () => ++turn === 1 ? { actions: [], unresolved: [], reads: [{ name: "get_material_stock", args: {} }] } : { actions: [], unresolved: [], answer: "Sand: 12 tonnes on hand." }), (error: unknown) => error instanceof MessagingAnswerResult && error.answer === "Sand: 12 tonnes on hand.");
  assert.deepEqual(calls, ["get_material_stock"]);
  await assert.rejects(draftDailyActions("Stock?", scope, [], async () => ({ actions: [], unresolved: [], answer: "12 tonnes" })), MessagingClarificationError);
  await assert.rejects(draftDailyActions("Stock?", { ...scope, reads: [], runRead: async () => { throw new Error("Must not run"); } }, [], async () => ({ actions: [], unresolved: [], reads: [{ name: "create_task", args: {} }] })), /unavailable/);
});

test("read history is withheld after any contributing grant or feature is revoked", () => {
  const permissions = { project: ["view"], materials: ["view"], tasks: ["view"] };
  const access = { permissions, workspacePermissions: {}, features: { enabled: { "commercial.materialsLedger": true } }, capabilities: { read: true } } as unknown as MessagingAccess;
  const snapshot = { permissions, workspacePermissions: {}, features: { "commercial.materialsLedger": true } };
  assert.equal(mayReadAnswer(access, snapshot), true);
  assert.equal(mayReadAnswer({ ...access, permissions: { ...permissions, materials: [] } }, snapshot), false);
  assert.equal(mayReadAnswer({ ...access, features: { dailyLogs: true, materialLogs: false, enabled: { "commercial.materialsLedger": false } } }, snapshot), false);
});

test("reordered corrections bind saved supplier details to stable actions rather than array positions", async () => {
  const previous = [
    { kind: "material_log" as const, reviewId: "sand-review", title: "Sand", payload: { entryType: "IN", materialName: "Sand", quantity: 10, unit: "tonne", supplier: "Alpha" } },
    { kind: "material_log" as const, reviewId: "cement-review", title: "Cement", payload: { entryType: "IN", materialName: "Cement", quantity: 20, unit: "bag", supplier: "Beta" } },
  ];
  const result = await draftDailyActions("Correct the quantities", scope, previous, async () => ({ actions: [
    { reviewId: "cement-review", kind: "material_log", payload: { quantity: 22 } },
    { reviewId: "sand-review", kind: "material_log", payload: { quantity: 11 } },
  ], unresolved: [] }));
  assert.deepEqual(result.map((action) => [action.payload.materialName, action.payload.quantity, action.payload.supplier]), [["Cement", 22, "Beta"], ["Sand", 11, "Alpha"]]);
  await assert.rejects(draftDailyActions("Correct quantities", scope, previous, async () => ({ actions: [
    { kind: "material_log", payload: { materialName: "Cement", quantity: 22 } },
    { kind: "material_log", payload: { materialName: "Sand", quantity: 11 } },
  ], unresolved: [] })), MessagingClarificationError);
});

test("a malformed model envelope is repaired once without dropping the order cancellation reason", async () => {
  let calls = 0;
  const [action] = await draftDailyActions("Cancel the cement order because the pour was postponed", scope, [], async (messages) => {
    if (++calls === 1) return { actions: [{ kind: "update_material_order", orderId: id, patch: { status: "Cancelled", reason: "Pour postponed" } }], unresolved: [] };
    assert.match(String(messages.at(-1)!.content), /INSIDE its payload/);
    return { actions: [{ kind: "update_material_order", payload: { orderId: id, patch: { status: "Cancelled", reason: "Pour postponed" } } }], unresolved: [] };
  });
  assert.equal(calls, 2); assert.equal(action!.kind, "update_material_order");
  assert.deepEqual(action!.payload.patch, { status: "Cancelled", reason: "Pour postponed" });
});

test("clarification keeps every missing fact across multiple incomplete deliveries", async () => {
  const questions = ["What did the tanker carry?", "What quantity arrived in the tanker?", "What unit was that quantity measured in?", "What sand material arrived?", "What quantity of sand arrived?", "What unit was the sand measured in?"];
  await assert.rejects(draftDailyActions("A tanker arrived and some sand arrived too", scope, [], async () => ({ actions: [], unresolved: questions })), (error: unknown) => error instanceof MessagingClarificationError && questions.every((question) => error.message.includes(question)));
});

test("canonical material review preserves authorized inline evidence and every full-form field", async () => {
  const photo = '![Delivery photo](/files/target-a/download)';
  const [action] = await draftDailyActions("Record the sand arrival with this delivery photo", scope, [], async () => ({ actions: [{ kind: "material_log", payload: { entryType: "IN", materialName: "Sand", quantity: 10, unit: "tonne", reason: `Delivery received\n\n${photo}`, fileIds: [id], supplier: "Supplier A", materialOrderId: id } }], unresolved: [] }));
  assert.equal(action!.payload.reason, `Delivery received\n\n${photo}`); assert.deepEqual(action!.payload.fileIds, [id]); assert.equal(action!.payload.materialOrderId, id);
  assert.match(String(action!.payload.notesHtml), /data-file-id="target-a"/);
});

test("delayed capture anchors relative dates and material occurrence to the original message", async () => {
  const messageSentAt = "2026-11-12T10:30:00.000Z";
  const [action] = await draftDailyActions("Received 10 tonnes of sand today", { ...scope, messageSentAt }, [], async (messages) => {
    assert.match(String(messages[0]!.content), /reference day is 2026-11-12/);
    return { actions: [{ kind: "material_log", payload: { entryType: "IN", materialName: "Sand", quantity: 10, unit: "tonne" } }], unresolved: [] };
  });
  assert.equal(action!.payload.occurredAt, messageSentAt);
  await assert.rejects(draftDailyActions("10 tonnes of sand; tanker held diesel", { ...scope, messageSentAt, recentMessages: [{ role: "user", content: "A tanker arrived", sentAt: "2026-11-10T10:30:00.000Z" }] }, [], async () => ({ actions: [{ kind: "material_log", payload: { entryType: "IN", materialName: "Diesel", quantity: 10, unit: "litre" } }], unresolved: [] })), MessagingClarificationError);
});

test("compound drawing history requires the linked RFI domain as well as drawing visibility", async () => {
  const { canReadMessagingReviewAction } = await import("./policy.ts");
  const access = { permissions: { documents: ["view"], rfis: [] }, workspacePermissions: {}, features: { dailyLogs: false, materialLogs: false, enabled: { "projects.documents": true, "workflow.rfis": true } } } as unknown as MessagingAccess;
  const action = { kind: "annotate_drawing", payload: { followUp: { kind: "rfi", payload: { question: "Private RFI" } } } };
  assert.equal(canReadMessagingReviewAction(access, action), false);
  assert.equal(canReadMessagingReviewAction({ ...access, permissions: { ...access.permissions, rfis: ["view"] } }, action), true);
});

test("an outer destination override is rejected rather than silently discarded", async () => {
  const { normalizeReview } = await import("./draft.ts");
  assert.throws(() => normalizeReview([{ kind: "material_log", projectId: "other-company", payload: samples.material_log }], scope), /selected authorized scope/);
});
