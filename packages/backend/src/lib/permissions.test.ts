import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePermissionMap, mapAllows } from "./permissions.ts";

const OWNER = resolvePermissionMap("owner", []);
const ADMIN = resolvePermissionMap("admin", []);
const MEMBER = resolvePermissionMap("member", []);
const VIEWER = resolvePermissionMap("viewer", []);

const MANAGE_RESOURCES = [
  "finances",
  "schedule",
  "contractors",
  "inspections",
  "bim",
  "selections",
  "approvals",
  "materials",
  "queries",
  "change-requests",
  "action-items",
  "key-dates",
  "permits",
  "risks",
] as const;

test("owner and admin can manage every construction resource", () => {
  for (const resource of MANAGE_RESOURCES) {
    assert.equal(mapAllows(OWNER, resource, "manage"), true, `owner ${resource}:manage`);
    assert.equal(mapAllows(ADMIN, resource, "manage"), true, `admin ${resource}:manage`);
  }
});

test("member retains manage on every resource it could write before the granular conversion", () => {
  for (const resource of MANAGE_RESOURCES) {
    assert.equal(mapAllows(MEMBER, resource, "manage"), true, `member ${resource}:manage`);
  }
});

test("member keeps the specific finances/schedule/dailyLog write actions the routes require", () => {
  assert.equal(mapAllows(MEMBER, "finances", "manage"), true);
  assert.equal(mapAllows(MEMBER, "schedule", "manage"), true);
  assert.equal(mapAllows(MEMBER, "dailyLog", "create"), true);
  assert.equal(mapAllows(MEMBER, "dailyLog", "void"), true);
  assert.equal(mapAllows(MEMBER, "materials", "request"), true);
  assert.equal(mapAllows(MEMBER, "documents", "upload"), true);
  assert.equal(mapAllows(MEMBER, "updates", "post"), true);
});

test("viewer can never manage any resource", () => {
  for (const resource of MANAGE_RESOURCES) {
    assert.equal(mapAllows(VIEWER, resource, "manage"), false, `viewer ${resource}:manage must be denied`);
  }
  assert.equal(mapAllows(VIEWER, "finances", "approve"), false);
  assert.equal(mapAllows(VIEWER, "selections", "decide"), false);
});

test("finances:approve stays owner/admin only (member cannot approve)", () => {
  assert.equal(mapAllows(OWNER, "finances", "approve"), true);
  assert.equal(mapAllows(ADMIN, "finances", "approve"), true);
  assert.equal(mapAllows(MEMBER, "finances", "approve"), false);
});
