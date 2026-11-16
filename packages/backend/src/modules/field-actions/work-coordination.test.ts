import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenError } from "../../lib/errors.ts";
import { workCoordinationHandlers, workCoordinationRequirements, workCoordinationSchemas } from "./work-coordination.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import { coordinationPayload } from "./work-coordination-support.ts";
import type { FieldToolContext, FieldToolInput } from "./tool-types.ts";

const examples = {
  rfi: { subject: "Beam detail", question: "Confirm reinforcement" }, update_rfi: { rfiId: "r", patch: { question: "Revised question" } },
  transition_rfi: { rfiId: "r", status: "Closed" }, comment_rfi: { rfiId: "r", body: "Site comment" }, respond_rfi: { rfiId: "r", body: "Use detail A" },
  change_request: { title: "Revised beam" }, update_change_request: { changeRequestId: "c", patch: { costImpact: 100 } },
  delete_change_request: { changeRequestId: "c" }, comment_change_request: { changeRequestId: "c", body: "Price agreed" },
  look_ahead: { name: "Week 1", startDate: "2026-11-16", endDate: "2026-11-22" },
  update_look_ahead: { lookAheadId: "l", patch: { totalWorkers: 0 } }, delete_look_ahead: { lookAheadId: "l" },
  log_activity: { activityId: "a", hoursLogged: 0 }, transition_stage: { stageId: "s", status: "InProgress" },
  create_task: { title: "Inspect pour", buildingId: "b" }, update_task: { taskId: "t", dueDate: null },
  move_task: { taskId: "t", columnId: "doing" }, delete_task: { taskId: "t" }, comment_task: { taskId: "t", body: "Complete" },
} as const;

test("all nineteen work actions use strict canonical schemas and matching requirement metadata", () => {
  const keys = Object.keys(examples).sort();
  assert.equal(keys.length, 19);
  for (const map of [workCoordinationHandlers, workCoordinationSchemas, workCoordinationRequirements]) assert.deepEqual(Object.keys(map).sort(), keys);
  for (const [kind, payload] of Object.entries(examples)) {
    const schema = workCoordinationSchemas[kind as keyof typeof examples];
    assert.deepEqual(validateFieldPayload(schema, structuredClone(payload)), payload);
    assert.throws(() => validateFieldPayload(schema, { ...payload, guessedId: "invented" }));
  }
  for (const [kind, payload] of [
    ["update_rfi", { rfiId: "r", patch: {} }], ["update_change_request", { changeRequestId: "c", patch: { status: "Approved" } }],
    ["update_task", { taskId: "t", priority: "Urgent" }], ["log_activity", { activityId: "a", hoursLogged: "8" }],
    ["log_activity", { activityId: "a", hoursLogged: -1 }], ["transition_stage", { stageId: "s", status: "Completed" }],
    ["comment_rfi", { rfiId: "r", body: "Discussion", official: true }],
    ["update_task", { taskId: "t" }], ["log_activity", { activityId: "a", hoursLogged: 8, logDate: "2026-02-30" }],
  ] as const) assert.throws(() => validateFieldPayload(workCoordinationSchemas[kind], payload));
});

test("HTML sanitation preserves approved rich content and source payloads without script execution", () => {
  const input: FieldToolInput = { kind: "update_rfi", projectId: "p", buildingId: "b", idempotencyKey: "receipt", payload: {
    rfiId: "r", patch: { question: "Detail\n\nTwo paragraphs", questionHtml: "<p>Detail</p><p><strong>Two paragraphs</strong></p><script>alert(1)</script>" },
  } };
  const output = coordinationPayload(input);
  assert.deepEqual(output.patch, { question: "Detail\n\nTwo paragraphs", questionHtml: "<p>Detail</p><p><strong>Two paragraphs</strong></p>" });
  assert.match((input.payload.patch as { questionHtml: string }).questionHtml, /script/);
});

test("every work action rejects scope changes and disabled features before accessing records", async () => {
  let features = 0;
  const context = { project: { id: "p" }, buildingId: "b", async requireFeature() { features++; throw new ForbiddenError("Feature disabled"); } } as unknown as FieldToolContext;
  for (const [kind, payload] of Object.entries(examples)) {
    const input: FieldToolInput = { kind, payload, projectId: "foreign", buildingId: "b", idempotencyKey: kind };
    const handler = workCoordinationHandlers[kind as keyof typeof examples];
    await assert.rejects(handler(input, context), /scope/);
    await assert.rejects(handler({ ...input, projectId: "p" }, context), /Feature disabled/);
  }
  assert.equal(features, 19);
});
