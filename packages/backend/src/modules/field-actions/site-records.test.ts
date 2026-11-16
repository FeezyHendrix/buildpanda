import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenError } from "../../lib/errors.ts";
import { authorizeMaterialApprovalDelete, authorizeMaterialApprovalUpdate } from "../approvals/material-access.ts";
import type { ApprovalStatus } from "../approvals/types.ts";
import { MAX_MATERIAL_QUANTITY, MATERIAL_QUANTITY_DECIMAL_PLACES } from "../materials-ledger/quantity.ts";
import { siteRecordHandlers, siteRecordSchemas } from "./site-records.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import type { FieldToolContext } from "./tool-types.ts";

test("site records expose exactly sixteen canonical actions and reject incomplete or invented payload fields", () => {
  assert.equal(Object.keys(siteRecordHandlers).length, 16);
  assert.deepEqual(Object.keys(siteRecordHandlers), Object.keys(siteRecordSchemas));
  assert.equal(siteRecordSchemas.material_log.properties.quantity.maximum, MAX_MATERIAL_QUANTITY);
  assert.equal(siteRecordSchemas.material_log.properties.quantity["x-decimalPlaces"], MATERIAL_QUANTITY_DECIMAL_PLACES);
  for (const [kind, payload] of [
    ["daily_log", { logDate: "today", bodyText: "Crew on site" }],
    ["daily_log", { logDate: "2026-11-16" }],
    ["daily_log", { logDate: "2026-11-16", bodyText: " " }],
    ["update_daily_log", { logDate: "2026-11-16", buildingId: "building" }],
    ["material_log", { entryType: "IN", materialName: "Sand", quantity: 20 }],
    ["material_log", { entryType: "IN", materialName: "Sand", quantity: 20, unit: "" }],
    ["material_log", { entryType: "IN", materialName: "Sand", quantity: 20, unit: " " }],
    ["material_log", { entryType: "IN", materialName: "Sand", quantity: 20, unit: "tonne", approvalStatus: "Approved" }],
    ["receive_material_order", { orderId: "order", quantity: 20 }],
    ["decide_material_approval", { approvalId: "approval", status: "Pending" }],
    ["update_material_approval", { approvalId: "approval" }],
    ["create_expense", { title: "Transport", category: "transport", amount: "1000", currency: "NGN", transactedAt: "2026-11-16" }],
    ["create_expense", { title: "Transport", category: "transport", amount: 1000, transactedAt: "2026-11-16" }],
    ["create_expense", { title: "Transport", category: "transport", amount: 1000, currency: "dollars", transactedAt: "2026-11-16" }],
  ] as const) assert.throws(() => validateFieldPayload(siteRecordSchemas[kind], payload));
  validateFieldPayload(siteRecordSchemas.receive_material_order, { orderId: "order", unit: "tonne", deliveredQty: 2, deliveredAt: "2026-11-16", rejected: true, rejectedReason: "Damaged" });
  validateFieldPayload(siteRecordSchemas.daily_log, { logDate: "2026-11-16", templateId: "template", responses: { workerCount: 6 } });
  validateFieldPayload(siteRecordSchemas.update_daily_log, { logDate: "2026-11-16", workersPresent: 0 });
  validateFieldPayload(siteRecordSchemas.update_daily_log, { logDate: "2026-11-16", weatherCondition: null });
  validateFieldPayload(siteRecordSchemas.create_expense, { title: "Transport", category: "transport", amount: 1000, currency: "NGN", transactedAt: "2026-11-16" });
});

test("shared material-approval guards preserve named reviewer decisions and Pending-only deletion", async () => {
  let reviewer = "reviewer", permission = "", userId = "approver";
  let status: ApprovalStatus = "Pending";
  const project = { id: "site", owner_id: "owner", organization_id: "company" };
  const request: FieldToolContext["request"] = { orgRoles: new Map(), orgPermissions: new Map(), projectRoles: new Map([["site", "site_agent"]]), projectGrants: new Map([["site", { materials: ["approve", "request"] }]]),
    requireAuth: () => ({ id: userId }), requireProjectAccess: async () => project,
    async requireProjectPermission(_id: string, resource: string, action: string) { assert.equal(resource, "materials"); permission = action; return project; },
  };
  const service = { get: async () => ({ requestedReviewerId: reviewer, status }) };
  await assert.rejects(authorizeMaterialApprovalUpdate(request, service, "site", "approval", { status: "Approved" }), ForbiddenError);
  assert.equal(permission, "approve"); userId = reviewer;
  await authorizeMaterialApprovalUpdate(request, service, "site", "approval", { status: "Rejected" });
  reviewer = ""; await authorizeMaterialApprovalUpdate(request, service, "site", "approval", { title: "Amended" });
  assert.equal(permission, "request");
  status = "Approved"; await assert.rejects(authorizeMaterialApprovalDelete(request, service, "site", "approval"), /Only pending/);
  status = "Pending"; await authorizeMaterialApprovalDelete(request, service, "site", "approval");
});
