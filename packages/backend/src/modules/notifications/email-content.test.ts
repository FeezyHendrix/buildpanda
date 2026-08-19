import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNotificationEmail, buildNotificationPush } from "./email-content.ts";
import type { NotificationType } from "./types.ts";

const PROJECT = "prj_1";

function ctaUrl(type: NotificationType, entityId: string | null = null): string {
  const { html } = buildNotificationEmail({
    recipientName: "Amara",
    type,
    title: "t",
    body: "b",
    projectId: PROJECT,
    ctaUrl: null,
    entityId,
  });
  const href = html.match(/href="(https?:[^"]*\/project\/[^"]*)"/)?.[1];
  assert.ok(href, `no project CTA link rendered for ${type}`);
  return href!;
}

test("an assigned task links to that task, not the project overview", () => {
  const url = ctaUrl("task_assigned", "tsk_42");
  assert.match(url, /\/project\/prj_1\/tasks\?task=tsk_42$/);
  assert.doesNotMatch(url, /overview/, "the old fallback must be gone");
});

test("a high-priority task also deep-links", () => {
  assert.match(ctaUrl("task_high_priority", "tsk_9"), /\/tasks\?task=tsk_9$/);
});

test("an assigned site activity links to that activity", () => {
  assert.match(
    ctaUrl("activity_assigned", "act_7"),
    /\/project\/prj_1\/schedules\/activities\/act_7$/,
  );
});

test("ids are URL-encoded so an odd id cannot break the link", () => {
  assert.match(ctaUrl("task_assigned", "a b&c"), /\?task=a%20b%26c$/);
});

test("a deep-linkable type still lands on its section when no id is given", () => {
  assert.match(ctaUrl("task_assigned", null), /\/project\/prj_1\/tasks$/);
});

test("types whose screens cannot focus one record land on the right section", () => {
  const cases: Array<[NotificationType, RegExp]> = [
    ["rfi_assigned", /\/rfis$/],
    ["approval_requested", /\/approvals$/],
    ["invoice_overdue", /\/finances\/invoices$/],
    ["milestone_released", /\/finances\/milestone-payments$/],
    ["permit_expiring", /\/permits$/],
    ["key_date_missed", /\/key-dates$/],
    ["document_uploaded", /\/documents$/],
    ["chat_mention", /\/chat$/],
    ["material_low_stock", /\/material-log$/],
    ["team_member_added", /\/team$/],
    ["selection_created", /\/selections$/],
    ["action_item_due", /\/action-items$/],
  ];
  for (const [type, expected] of cases) {
    const url = ctaUrl(type);
    assert.match(url, expected, `${type} pointed at ${url}`);
    assert.doesNotMatch(url, /overview/, `${type} still falls back to the overview`);
  }
});

test("an explicit ctaUrl still wins over the map", () => {
  const { html } = buildNotificationEmail({
    recipientName: "Amara",
    type: "task_assigned",
    title: "t",
    body: "b",
    projectId: PROJECT,
    ctaUrl: "https://example.test/custom",
    entityId: "tsk_1",
  });
  assert.match(html, /href="https:\/\/example\.test\/custom"/);
});

test("with no project it falls back to the dashboard rather than a broken path", () => {
  const { html } = buildNotificationEmail({
    recipientName: "Amara",
    type: "task_assigned",
    title: "t",
    body: "b",
    projectId: null,
    ctaUrl: null,
    entityId: "tsk_1",
  });
  assert.match(html, /href="[^"]*\/dashboard"/);
});

test("push notifications resolve the same destination as the email", () => {
  const push = buildNotificationPush({
    type: "task_assigned",
    title: "t",
    body: "b",
    projectId: PROJECT,
    ctaUrl: null,
    entityId: "tsk_42",
  });
  assert.match(push.url, /\/project\/prj_1\/tasks\?task=tsk_42$/);
});
