import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PARTICIPANT_PERMISSIONS,
  ROLE_PRESET_SIDES,
  canProjectPermission,
  composeParticipantPermissions,
  rolePresetSides,
  rolePresets,
  type EnrichedAccessContext,
} from "./authorization.ts";
import { resolvePermissionMap, statement } from "./permissions.ts";

const PROJECT = { id: "prj_1", ownerId: "usr_owner", organizationId: "org_1" };

function participantCtx(role: string): EnrichedAccessContext {
  return {
    userId: "usr_participant",
    orgRoles: new Map(),
    orgPermissions: new Map(),
    projectRoles: new Map([[PROJECT.id, role]]),
  };
}

function orgCtx(orgRole: string): EnrichedAccessContext {
  return {
    userId: "usr_staff",
    orgRoles: new Map([["org_1", orgRole]]),
    orgPermissions: new Map([["org_1", resolvePermissionMap(orgRole, [])]]),
    projectRoles: new Map(),
  };
}

test("finance reading is split into the client-facing view and the internal cost view", () => {
  assert.ok(statement.finances.includes("view"));
  assert.ok(statement.finances.includes("viewCosts"));
});

test("the Client preset sees the contract it is party to and never the contractor's costs", () => {
  const client = participantCtx("client");
  // The contract sum, the certificates raised against them, retention, payments.
  assert.equal(canProjectPermission(PROJECT, client, "finances", "view"), true);
  assert.equal(canProjectPermission(PROJECT, client, "finances", "dispute"), true);
  // Expenses, purchase orders, budget vs actual, margin.
  assert.equal(canProjectPermission(PROJECT, client, "finances", "viewCosts"), false);
  assert.equal(canProjectPermission(PROJECT, client, "finances", "manage"), false);
});

test("the Resident Engineer is client-side: decides variations, sees no costs", () => {
  const re = participantCtx("resident_engineer");
  assert.equal(canProjectPermission(PROJECT, re, "finances", "view"), true);
  assert.equal(canProjectPermission(PROJECT, re, "finances", "viewCosts"), false);
  assert.equal(canProjectPermission(PROJECT, re, "change-requests", "approve"), true);
  assert.equal(canProjectPermission(PROJECT, re, "approvals", "decide"), true);
  assert.equal(canProjectPermission(PROJECT, re, "inspections", "manage"), true);
  assert.equal(canProjectPermission(PROJECT, re, "rfis", "respond"), true);
});

test("contractor-side commercial roles read the cost position", () => {
  for (const role of ["project_manager", "quantity_surveyor", "site_agent"]) {
    const ctx = participantCtx(role);
    assert.equal(canProjectPermission(PROJECT, ctx, "finances", "view"), true, role);
    assert.equal(canProjectPermission(PROJECT, ctx, "finances", "viewCosts"), true, role);
  }
});

test("the QS proposes changes; deciding them is a separate grant they do not hold", () => {
  const qs = participantCtx("quantity_surveyor");
  assert.equal(canProjectPermission(PROJECT, qs, "change-requests", "manage"), true);
  assert.equal(canProjectPermission(PROJECT, qs, "change-requests", "approve"), false);
});

test("org staff read both halves; a read-only org viewer still sees internal cost", () => {
  for (const role of ["owner", "admin", "member", "viewer"]) {
    const ctx = orgCtx(role);
    assert.equal(canProjectPermission(PROJECT, ctx, "finances", "view"), true, role);
    assert.equal(canProjectPermission(PROJECT, ctx, "finances", "viewCosts"), true, role);
  }
});

test("hiding the budget page in the participant matrix actually revokes viewCosts", () => {
  const composed = composeParticipantPermissions(PARTICIPANT_PERMISSIONS["project_manager"], {
    "commercial.budget": "hidden",
    "commercial.purchaseOrders": "hidden",
    "commercial.expenses": "hidden",
    "commercial.finances": "view",
  });
  assert.ok(composed["finances"]?.includes("view"));
  assert.equal(composed["finances"]?.includes("viewCosts"), false);
});

test("every construction role a QS would ask for exists as a starter preset, with a side", () => {
  const presets = rolePresets();
  const sides = rolePresetSides();
  for (const role of [
    "resident_engineer",
    "quantity_surveyor",
    "site_agent",
    "surveyor",
    "foreman",
    "materials_engineer",
  ]) {
    assert.ok(presets[role], `${role} preset is missing`);
    assert.ok(sides[role], `${role} has no contract side`);
  }
  assert.equal(ROLE_PRESET_SIDES["resident_engineer"], "client");
  assert.equal(ROLE_PRESET_SIDES["quantity_surveyor"], "contractor");
  assert.equal(ROLE_PRESET_SIDES["materials_engineer"], "consultant");
});
