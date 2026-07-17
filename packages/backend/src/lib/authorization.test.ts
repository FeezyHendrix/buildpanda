import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertCanGrant,
  assertProjectPermission,
  canProjectPermission,
  grantableCatalog,
  isPrivilegedGrant,
  type EnrichedAccessContext,
  type GrantValidationContext,
  type ProjectSectionPermissions,
} from "./authorization.ts";
import { resolvePermissionMap } from "./permissions.ts";
import { ForbiddenError } from "./errors.ts";

const PROJECT = { id: "proj_1", ownerId: "owner_1", organizationId: "org_1" };

function ctxWithSectionMatrix(
  userId: string,
  matrix: ProjectSectionPermissions,
): EnrichedAccessContext {
  return {
    userId,
    orgRoles: new Map(),
    orgPermissions: new Map([["org_1", resolvePermissionMap("stakeholder-no-perms", [])]]),
    projectRoles: new Map([["proj_1", "stakeholder-no-perms"]]),
    projectSectionPermissions: new Map([["proj_1", matrix]]),
  };
}

function ctxWithParticipantRole(
  role: string,
  matrix?: ProjectSectionPermissions,
): EnrichedAccessContext {
  return {
    userId: "user_1",
    orgRoles: new Map(),
    orgPermissions: new Map(),
    projectRoles: new Map([["proj_1", role]]),
    projectSectionPermissions: matrix ? new Map([["proj_1", matrix]]) : new Map(),
  };
}

function allows(ctx: EnrichedAccessContext, resource: string, action: string): boolean {
  try {
    assertProjectPermission(PROJECT, ctx, resource, action);
    return true;
  } catch (err) {
    assert.ok(err instanceof ForbiddenError);
    return false;
  }
}

test("section-matrix 'edit' grants schedule:manage through the backend guard", () => {
  const ctx = ctxWithSectionMatrix("user_1", { "projects.schedule": "edit" });
  assert.equal(allows(ctx, "schedule", "manage"), true);
  assert.equal(allows(ctx, "schedule", "view"), true);
});

test("schedule section bridges to stages: 'edit' grants stages:manage, 'view' grants stages:view only", () => {
  const editor = ctxWithSectionMatrix("user_1", { "projects.schedule": "edit" });
  assert.equal(allows(editor, "stages", "view"), true);
  assert.equal(allows(editor, "stages", "manage"), true);
  const viewer = ctxWithSectionMatrix("user_2", { "projects.schedule": "view" });
  assert.equal(allows(viewer, "stages", "view"), true);
  assert.equal(allows(viewer, "stages", "manage"), false);
  const hidden = ctxWithSectionMatrix("user_3", { "projects.schedule": "hidden" });
  assert.equal(allows(hidden, "stages", "view"), false);
});

test("section-matrix 'edit' grants documents:upload through the backend guard", () => {
  const ctx = ctxWithSectionMatrix("user_1", { "projects.documents": "edit" });
  assert.equal(allows(ctx, "documents", "upload"), true);
  assert.equal(allows(ctx, "documents", "view"), true);
});

test("section-matrix 'edit' on a workflow section grants comments:post (author parity)", () => {
  const ctx = ctxWithSectionMatrix("user_1", { "workflow.queries": "edit" });
  assert.equal(allows(ctx, "queries", "raise"), true);
  assert.equal(allows(ctx, "comments", "post"), true);
  // must stay author-level only — never the manage/delete action
  assert.equal(allows(ctx, "queries", "manage"), false);
});

test("section-matrix 'view' on a workflow section does NOT grant comments:post", () => {
  const ctx = ctxWithSectionMatrix("user_1", { "workflow.queries": "view" });
  assert.equal(allows(ctx, "queries", "view"), true);
  assert.equal(allows(ctx, "comments", "post"), false);
});

test("section-matrix never grants privileged actions it does not map (finances:manage)", () => {
  const ctx = ctxWithSectionMatrix("user_1", { "commercial.budget": "edit" });
  assert.equal(allows(ctx, "finances", "view"), true);
  assert.equal(allows(ctx, "finances", "manage"), false);
  assert.equal(allows(ctx, "documents", "upload"), false);
});

test("section-matrix 'hidden' grants nothing for that resource", () => {
  const ctx = ctxWithSectionMatrix("user_1", { "projects.schedule": "hidden" });
  assert.equal(allows(ctx, "schedule", "view"), false);
  assert.equal(allows(ctx, "schedule", "manage"), false);
});

test("assertProjectPermission and canProjectPermission stay in exact parity", () => {
  const ctx = ctxWithSectionMatrix("user_1", {
    "projects.schedule": "edit",
    "projects.documents": "view",
    "commercial.budget": "edit",
    "workflow.queries": "edit",
  });
  const cases: Array<[string, string]> = [
    ["schedule", "view"],
    ["schedule", "manage"],
    ["documents", "view"],
    ["documents", "upload"],
    ["documents", "delete"],
    ["finances", "view"],
    ["finances", "manage"],
    ["queries", "view"],
    ["queries", "raise"],
    ["teamMembers", "manage"],
  ];
  for (const [resource, action] of cases) {
    assert.equal(
      allows(ctx, resource, action),
      canProjectPermission(PROJECT, ctx, resource, action),
      `parity mismatch for ${resource}:${action}`,
    );
  }
});

test("project owner bypasses all resource checks", () => {
  const ctx = ctxWithSectionMatrix("owner_1", {});
  assert.equal(allows(ctx, "finances", "manage"), true);
  assert.equal(allows(ctx, "teamMembers", "manage"), true);
});

test("participant role default grants its actions with no matrix", () => {
  const ctx = ctxWithParticipantRole("project_manager");
  assert.equal(allows(ctx, "schedule", "manage"), true);
  assert.equal(allows(ctx, "rfis", "create"), true);
});

test("matrix 'hidden' revokes a matrix-expressible role default", () => {
  const ctx = ctxWithParticipantRole("project_manager", { "projects.schedule": "hidden" });
  assert.equal(allows(ctx, "schedule", "manage"), false);
  assert.equal(allows(ctx, "schedule", "view"), false);
});

test("matrix does NOT revoke role actions it cannot express (client keeps finances:dispute)", () => {
  const ctx = ctxWithParticipantRole("client", { "commercial.finances": "hidden" });
  assert.equal(allows(ctx, "finances", "dispute"), true);
  assert.equal(allows(ctx, "finances", "view"), false);
});

test("stored grants are authoritative and bypass role/matrix legacy path", () => {
  const ctx: EnrichedAccessContext = {
    userId: "user_1",
    orgRoles: new Map(),
    orgPermissions: new Map(),
    projectRoles: new Map([["proj_1", "client"]]),
    projectSectionPermissions: new Map(),
    projectGrants: new Map([["proj_1", { finances: ["view", "approve"], schedule: ["view"] }]]),
  };
  assert.equal(allows(ctx, "finances", "approve"), true);
  assert.equal(allows(ctx, "schedule", "view"), true);
  assert.equal(allows(ctx, "finances", "dispute"), false);
  assert.equal(allows(ctx, "approvals", "decide"), false);
});

test("absent grants fall back to identical legacy compose", () => {
  const legacy = ctxWithParticipantRole("client", { "workflow.approvals": "edit" });
  const dual: EnrichedAccessContext = { ...legacy, projectGrants: new Map() };
  for (const [res, act] of [
    ["approvals", "decide"],
    ["finances", "dispute"],
    ["queries", "raise"],
    ["schedule", "manage"],
  ] as const) {
    assert.equal(allows(dual, res, act), allows(legacy, res, act), `${res}:${act} drifted`);
  }
});

function grantCtx(isOrgAdmin: boolean): GrantValidationContext {
  return {
    userId: "inviter_1",
    orgRoles: new Map(),
    orgPermissions: new Map(),
    projectRoles: new Map(),
    projectSectionPermissions: new Map(),
    projectGrants: new Map(),
    isOrgAdmin,
  };
}

test("privileged classification matches the validated partition", () => {
  assert.equal(isPrivilegedGrant("finances", "approve"), true);
  assert.equal(isPrivilegedGrant("approvals", "decide"), true);
  assert.equal(isPrivilegedGrant("tasks", "remove"), true);
  assert.equal(isPrivilegedGrant("project", "update"), true);
  assert.equal(isPrivilegedGrant("participants", "manage"), true);
  assert.equal(isPrivilegedGrant("dailyLog", "void"), true);
  // basic (author/read) actions
  assert.equal(isPrivilegedGrant("finances", "dispute"), false);
  assert.equal(isPrivilegedGrant("rfis", "respond"), false);
  assert.equal(isPrivilegedGrant("updates", "post"), false);
  assert.equal(isPrivilegedGrant("queries", "raise"), false);
});

test("grantable catalog excludes org/sales surfaces", () => {
  const cat = grantableCatalog();
  for (const excluded of ["orgProfile", "teamMembers", "proposals", "leads"]) {
    assert.equal(cat[excluded], undefined, `${excluded} must not be grantable`);
  }
  assert.ok(cat.finances?.includes("approve"));
});

// Regression: presets/editor grant `stages:view`; missing from statement => rejected as unknown.
test("stages:view is grantable (preset/editor section)", () => {
  assert.ok(grantableCatalog().stages?.includes("view"));
  assert.doesNotThrow(() =>
    assertCanGrant(grantCtx(false), { schedule: ["view"], stages: ["view"] }),
  );
});

test("non-admin inviter cannot grant privileged actions", () => {
  assert.throws(
    () => assertCanGrant(grantCtx(false), { finances: ["view", "approve"] }),
    (err: Error) => err.message.includes("owner or admin") && err.message.includes("finances:approve"),
  );
});

test("org admin inviter can grant privileged actions", () => {
  assert.doesNotThrow(() =>
    assertCanGrant(grantCtx(true), { approvals: ["view", "decide"], finances: ["view", "approve"] }),
  );
});

test("non-admin inviter can grant basic actions", () => {
  assert.doesNotThrow(() =>
    assertCanGrant(grantCtx(false), {
      finances: ["view", "dispute"],
      rfis: ["view", "create", "respond"],
      updates: ["view", "post"],
    }),
  );
});

test("unknown or excluded resource:action is rejected", () => {
  assert.throws(
    () => assertCanGrant(grantCtx(true), { proposals: ["view"] }),
    (err: Error) => err.message.includes("non-grantable") && err.message.includes("proposals:view"),
  );
  assert.throws(
    () => assertCanGrant(grantCtx(true), { finances: ["teleport"] }),
    (err: Error) => err.message.includes("finances:teleport"),
  );
});
