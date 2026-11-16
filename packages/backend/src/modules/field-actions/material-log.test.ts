import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { materialLogPermissionActions, requireMaterialLogPermission } from "../materials-ledger/permissions.ts";
import { validateMaterialQuantity } from "../materials-ledger/quantity.ts";
import { materialLogAuthorizer } from "./material-log-authorization.ts";
import { createMaterialLedgerExecutor, validateMaterialLogCommand } from "./material-log.ts";
import type { MaterialLogAuthorizationDeps, MaterialLogCommand } from "./material-types.ts";
import type { LogEntryResult } from "../materials-ledger/types.ts";

const actor = { userId: "crew", organizationId: "company" };
const command: MaterialLogCommand = { kind: "material_log", projectId: "site", payload: {
  entryType: "IN", materialName: "Sand", unit: "tonnes", quantity: 20, idempotencyKey: "action-1",
} };

test("ledger quantity validation never rounds or converts the supplied quantity", () => {
  for (const quantity of [0.01, 0.29, 4.1, 99.99, 999999999999.99]) validateMaterialQuantity(quantity);
  for (const quantity of [0, -1, NaN, Infinity, 0.001, 0.30000000000000004, 4.123, 1_000_000_000_000]) assert.throws(() => validateMaterialQuantity(quantity));
  assert.throws(() => validateMaterialQuantity(0.001), /smaller unit/);
});

test("material validation preserves explicit delivery facts and safe notes without mutating source", () => {
  const input = { ...command, payload: { ...command.payload, materialName: " Sand ", unit: " tonnes ",
    occurredAt: "2026-11-16T12:17:40+01:00", locationKey: "Yard B", reason: "Expected last week.\n\nReceived today — 20 tonnes <dry>." } };
  const before = structuredClone(input), value = validateMaterialLogCommand(input);
  assert.deepEqual(input, before); assert.equal(value.payload.materialName, "Sand"); assert.equal(value.payload.unit, "tonnes");
  assert.equal(value.payload.quantity, 20); assert.equal(value.payload.occurredAt, input.payload.occurredAt);
  assert.equal(value.payload.reason, input.payload.reason); assert.equal(value.payload.locationKey, "Yard B");
  assert.equal(value.payload.notesHtml, "<p>Expected last week.<br /><br />Received today — 20 tonnes &lt;dry&gt;.</p>");
});

test("material validation requires positive finite quantity and an explicit material and unit", () => {
  for (const payload of [
    { ...command.payload, quantity: 0 }, { ...command.payload, quantity: -1 },
    { ...command.payload, quantity: NaN }, { ...command.payload, quantity: Infinity },
    { ...command.payload, quantity: "20" }, { ...command.payload, materialName: " " },
    { ...command.payload, unit: "" }, { ...command.payload, unit: " " }, { ...command.payload, unit: undefined },
    { ...command.payload, entryType: "VOID" }, { ...command.payload, materialName: null },
  ]) assert.throws(() => validateMaterialLogCommand({ ...command, payload }));
});

test("material actions cannot invent record targets, approval decisions, attachments or dates", () => {
  for (const extra of [
    { buildingId: "invented" }, { stageId: "invented" }, { materialOrderId: "invented" },
    { taskId: "invented" }, { materialId: "invented" }, { fileIds: ["photo"] },
    { approvalStatus: "Approved" }, { templateId: "form" },
    { occurredAt: "2026-02-30T00:00:00Z" }, { occurredAt: "last week" },
    { notesHtml: '<p>Proof</p><img src="/files/photo/download" data-file-id="photo">' },
  ]) assert.throws(() => validateMaterialLogCommand({ ...command, payload: { ...command.payload, ...extra } }));
  assert.throws(() => validateMaterialLogCommand({ ...command, buildingId: "invented" }));
});

test("canonical material movement permission policy preserves request-only receipts and manage-only usage", async () => {
  assert.deepEqual(materialLogPermissionActions("IN"), ["request", "manage"]);
  assert.deepEqual(materialLogPermissionActions("USED"), ["manage"]);
  const calls: string[] = [];
  const request = { async requireProjectPermission(_id: string, resource: string, action: string) {
    assert.equal(resource, "materials"); calls.push(action);
    if (action !== "manage") throw new ForbiddenError();
    return { id: "site", owner_id: "owner", organization_id: "company" };
  } };
  await requireMaterialLogPermission(request, "site", "IN"); assert.deepEqual(calls, ["request", "manage"]);
  const missing = { requireProjectPermission: async () => { throw new NotFoundError("Project"); } };
  await assert.rejects(requireMaterialLogPermission(missing, "site", "IN"), NotFoundError);
});

test("material authorization resolves current grants, organization, account status and feature availability", async () => {
  let grants = { project: ["view"], materials: ["request"] }, enabled = true, banned = false;
  const deps: MaterialLogAuthorizationDeps = {
    userById: async (id) => ({ id, name: "Crew", banned }),
    loadAccess: async (userId) => ({ userId, orgRoles: new Map(), orgPermissions: new Map(),
      projectRoles: new Map([["site", "site_agent"]]), projectGrants: new Map([["site", grants]]) }),
    projectById: async (id) => id === "site" ? { id, owner_id: "owner", organization_id: "company" } : undefined,
    isEnabled: async () => enabled,
  };
  const authorize = materialLogAuthorizer(deps);
  assert.equal((await authorize(actor, "site", "IN")).actor.id, actor.userId);
  await assert.rejects(authorize(actor, "site", "USED"), ForbiddenError);
  grants = { project: ["view"], materials: ["manage"] };
  await authorize(actor, "site", "IN"); await authorize(actor, "site", "USED");
  grants = { project: ["view"], materials: [] }; await assert.rejects(authorize(actor, "site", "IN"), ForbiddenError);
  grants = { project: ["view"], materials: ["request"] };
  await assert.rejects(authorize({ ...actor, organizationId: "another-company" }, "site", "IN"), ForbiddenError);
  await assert.rejects(authorize(actor, "another-project", "IN"), NotFoundError);
  enabled = false; await assert.rejects(authorize(actor, "site", "IN"), /disabled/i); enabled = true;
  banned = true; await assert.rejects(authorize(actor, "site", "IN"), ForbiddenError);
});

test("executor authorizes each action before canonical logging and requires a stable idempotency key", async () => {
  const calls: string[] = [];
  const executor = createMaterialLedgerExecutor({
    authorize: async (value, projectId, type) => {
      calls.push("authorize"); assert.deepEqual(value, actor); assert.equal(projectId, "site"); assert.equal(type, "IN");
      return { project: { id: projectId, owner_id: "owner", organization_id: "company" }, actor: { id: "crew", name: "Crew" } };
    },
    ledger: { async logEntry(projectId, payload, actorId) {
      calls.push("log"); assert.equal(projectId, "site"); assert.equal(actorId, "crew"); assert.deepEqual(payload, command.payload);
      return { entry: { id: "ledger-1", materialName: "Sand", quantity: 20, unit: "tonne" }, onHandQty: 20, duplicate: false } as LogEntryResult;
    } },
  });
  const result = await executor.execute(command, actor);
  assert.deepEqual(calls, ["authorize", "log"]); assert.equal(result.recordId, "ledger-1"); assert.equal(result.unit, "tonne");
  await assert.rejects(executor.execute({ ...command, payload: { ...command.payload, idempotencyKey: undefined } }, actor), /idempotency/);
  assert.deepEqual(calls, ["authorize", "log"]);
});
