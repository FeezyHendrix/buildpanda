import assert from "node:assert/strict";
import { test } from "node:test";
import { attentionService, tagFor } from "./service.ts";
import type { AttentionRow } from "./types.ts";

const row = (over: Partial<AttentionRow>): AttentionRow => ({
  id: "x",
  kind: "rfi",
  title: "t",
  status: "Open",
  due_date: null,
  assignee_id: null,
  assignee_name: null,
  assignee_profession: null,
  ...over,
});
const today = "2026-11-07";

test("tags: blocking when late, due soon inside a week, review when waiting on someone", () => {
  assert.equal(tagFor(row({ due_date: "2026-11-01" }), today), "blocking");
  assert.equal(tagFor(row({ due_date: "2026-11-10" }), today), "due_soon");
  assert.equal(tagFor(row({ due_date: "2026-12-01" }), today), "review");
  assert.equal(tagFor(row({ kind: "task", due_date: "2026-12-01" }), today), null, "a far-off task is not attention");
  assert.equal(tagFor(row({ kind: "permit", status: "Approved", due_date: "2026-11-09" }), today), "due_soon");
  assert.equal(tagFor(row({ kind: "permit", status: "Applied" }), today), "review");
  assert.equal(tagFor(row({ kind: "key_date", status: "Missed", due_date: "2026-11-01" }), today), "blocking");
  assert.equal(tagFor(row({ kind: "inspection", status: "Action Required" }), today), "blocking");
});

test("feed orders blocking first, then nearest date, respects limit and reports the total", async () => {
  const rows = [
    row({ id: "a", kind: "approval", due_date: "2026-12-01", assignee_id: "u1", assignee_name: "Eng. Kanayo", assignee_profession: "MEP Engineer" }),
    row({ id: "b", kind: "task", due_date: "2026-11-09" }),
    row({ id: "c", kind: "rfi", due_date: "2026-11-01" }),
    row({ id: "d", kind: "task", due_date: "2027-01-01" }),
  ];
  const service = attentionService({ candidates: async () => rows });
  const feed = await service.feed("prj", ["rfi", "approval", "task"], false, 2);
  assert.deepEqual(feed.items.map((i) => [i.id, i.tag]), [["c", "blocking"], ["b", "due_soon"]]);
  assert.equal(feed.total, 3);
  const all = await service.feed("prj", ["rfi", "approval", "task"], false, 10);
  const approval = all.items.find((i) => i.id === "a")!;
  assert.deepEqual(approval.assignee, { id: "u1", name: "Eng. Kanayo", profession: "MEP Engineer" });
  assert.equal(approval.href, "/project/prj/approvals?approval=a");
});
