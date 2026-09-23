import assert from "node:assert/strict";
import { test } from "node:test";
import { drawingMarkupEditing } from "./editing.ts";
import type { MarkupContext } from "./mappers.ts";
import { toMarkup } from "./mappers.ts";
import type {
  CommentAuthorRow,
  DrawingMarkupCommentRow,
  DrawingMarkupRow,
  MarkupAuditSink,
  MarkupEditingStore,
} from "./types.ts";

// A redline on a take-off sheet is a contractual record: it is withdrawn, never
// erased; only its author may reword what they said; and an edit made against a
// stale version must lose loudly rather than quietly overwrite someone else.
// The SQL half of that claim lives in precon-editor-db.test.ts.

const AT = new Date("2026-09-01T00:00:00.000Z");

const EMPTY_CONTEXT: MarkupContext = {
  comments: new Map(),
  names: new Map(),
  rfiByMarkup: new Map(),
  approvalByMarkup: new Map(),
  currentVersionByDocument: new Map(),
  revisionByVersion: new Map(),
};

function markupRow(over: Partial<DrawingMarkupRow> = {}): DrawingMarkupRow {
  return {
    id: "mk_1",
    project_id: null,
    document_id: null,
    document_version_id: null,
    page_no: null,
    precon_session_id: "pcs_1",
    precon_sheet_id: "psh_1",
    precon_row_id: "pbr_1",
    kind: "pin",
    geometry: { kind: "pin", at: { x: 10, y: 20 }, space: "points" },
    color: "#004DE7",
    created_by_id: "usr_a",
    resolved_at: null,
    resolved_by_id: null,
    version: 3,
    deleted_at: null,
    style: null,
    created_at: AT,
    updated_at: AT,
    ...over,
  };
}

function commentRow(over: Partial<DrawingMarkupCommentRow> = {}): DrawingMarkupCommentRow {
  return {
    id: "mkc_1",
    markup_id: "mk_1",
    body: "Check this junction",
    body_html: null,
    media_kind: null,
    file_id: null,
    media_duration_seconds: null,
    assignee_id: null,
    created_by_id: "usr_a",
    version: 2,
    deleted_at: null,
    created_at: AT,
    updated_at: AT,
    ...over,
  };
}

function store(over: Partial<MarkupEditingStore> = {}): MarkupEditingStore {
  return {
    updateMarkup: async () => null,
    updateComment: async () => null,
    softDeleteMarkup: async () => null,
    restoreMarkup: async () => null,
    softDeleteCommentsForMarkup: async () => 0,
    commentsForMarkupIncludeDeleted: async () => [],
    restoreCommentsForMarkup: async () => 0,
    commentById: async () => undefined,
    commentAuthorsForMarkup: async () => [],
    usersByIds: async () => [],
    ...over,
  };
}

function recorder(): MarkupAuditSink & { entries: Record<string, unknown>[] } {
  const entries: Record<string, unknown>[] = [];
  return {
    entries,
    insertAuditEvent: async (row) => {
      entries.push({ ...row });
    },
  };
}

function editing(
  row: DrawingMarkupRow,
  repo: MarkupEditingStore,
  audit?: MarkupAuditSink,
): ReturnType<typeof drawingMarkupEditing> {
  return drawingMarkupEditing({
    repo,
    audit,
    loadMarkup: async () => row,
    getMarkup: async () => toMarkup(row, EMPTY_CONTEXT),
  });
}

test("editMarkup: version mismatch throws ConflictError and writes nothing", async () => {
  let written = false;
  const service = editing(
    markupRow({ version: 4 }),
    store({
      updateMarkup: async () => {
        written = true;
        return null;
      },
    }),
  );

  await assert.rejects(
    service.editMarkup("mk_1", "usr_a", { version: 3, color: "#FF0000" }),
    /changed since you loaded it/i,
  );
  assert.equal(written, false, "a stale edit never reaches the table");
});

test("editMarkup: a lost race on the UPDATE is still a conflict", async () => {
  const service = editing(markupRow({ version: 3 }), store({ updateMarkup: async () => null }));
  await assert.rejects(
    service.editMarkup("mk_1", "usr_a", { version: 3, color: "#FF0000" }),
    /changed since you loaded it/i,
  );
});

test("editMarkup: moving a pin bumps the version and audits before and after", async () => {
  const before = markupRow({ version: 3 });
  const moved = markupRow({ version: 4, geometry: { kind: "pin", at: { x: 99, y: 5 }, space: "points" } });
  const audit = recorder();
  const service = editing(before, store({ updateMarkup: async () => moved }), audit);

  await service.editMarkup("mk_1", "usr_b", {
    version: 3,
    geometry: { kind: "pin", at: { x: 99, y: 5 }, space: "points" },
  });

  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0]?.["action"], "markup_edit");
  assert.equal(audit.entries[0]?.["session_id"], "pcs_1");
  assert.equal(audit.entries[0]?.["row_id"], "pbr_1");
  assert.equal(audit.entries[0]?.["actor"], "usr_b");
  assert.deepEqual(audit.entries[0]?.["before"], {
    markupId: "mk_1",
    geometry: { kind: "pin", at: { x: 10, y: 20 }, space: "points" },
    color: "#004DE7",
    style: null,
    version: 3,
    deletedAt: null,
  });
  assert.equal((audit.entries[0]?.["after"] as { version: number }).version, 4);
});

test("editComment: another participant is rejected with ForbiddenError", async () => {
  let written = false;
  const service = editing(
    markupRow(),
    store({
      commentById: async () => commentRow({ created_by_id: "usr_a" }),
      updateComment: async () => {
        written = true;
        return null;
      },
    }),
  );

  await assert.rejects(
    service.editComment("mk_1", "mkc_1", "usr_b", { version: 2, body: "Reworded" }),
    /only the comment's author can edit it/i,
  );
  assert.equal(written, false, "someone else's words are never rewritten");
});

test("editComment: version mismatch throws ConflictError", async () => {
  const service = editing(
    markupRow(),
    store({ commentById: async () => commentRow({ version: 5 }) }),
  );

  await assert.rejects(
    service.editComment("mk_1", "mkc_1", "usr_a", { version: 2, body: "Reworded" }),
    /changed since you loaded it/i,
  );
});

test("editComment: the author's edit is sanitised and version-bumped", async () => {
  let patched: { version: number; body: string; body_html: string | null } | null = null;
  const service = editing(
    markupRow(),
    store({
      commentById: async () => commentRow({ version: 2 }),
      updateComment: async (_id, patch) => {
        patched = patch;
        return commentRow({ version: 3, body: patch.body, body_html: patch.body_html });
      },
      usersByIds: async () => [{ id: "usr_a", name: "Ada" }],
    }),
  );

  const updated = await service.editComment("mk_1", "mkc_1", "usr_a", {
    version: 2,
    body: "  Reworded  ",
    bodyHtml: "<p>Reworded</p><script>steal()</script>",
  });

  assert.deepEqual(patched, {
    version: 2,
    body: "Reworded",
    body_html: "<p>Reworded</p>",
  });
  assert.equal(updated.version, 3);
  assert.equal(updated.authorName, "Ada");
});

test("softDeleteMarkup: an unresolved thread someone else replied to is blocked", async () => {
  const authors: CommentAuthorRow[] = [
    { id: "mkc_1", created_by_id: "usr_a" },
    { id: "mkc_2", created_by_id: "usr_b" },
  ];
  let written = false;
  const service = editing(
    markupRow({ resolved_at: null }),
    store({
      commentAuthorsForMarkup: async () => authors,
      softDeleteMarkup: async () => {
        written = true;
        return null;
      },
    }),
  );

  await assert.rejects(
    service.softDeleteMarkup("mk_1", "usr_a", 3),
    /resolve the thread first/i,
  );
  assert.equal(written, false);
});

test("softDeleteMarkup: the author's own unanswered note may be withdrawn", async () => {
  const deleted: string[] = [];
  const service = editing(
    markupRow(),
    store({
      commentAuthorsForMarkup: async () => [
        { id: "mkc_1", created_by_id: "usr_a" },
        { id: "mkc_2", created_by_id: "usr_a" },
      ],
      softDeleteMarkup: async (id) => {
        deleted.push(id);
        return markupRow({ version: 4, deleted_at: AT });
      },
      softDeleteCommentsForMarkup: async (markupId) => {
        deleted.push(`comments:${markupId}`);
        return 2;
      },
    }),
  );

  assert.deepEqual(await service.softDeleteMarkup("mk_1", "usr_a", 3), { ok: true });
  assert.deepEqual(deleted, ["mk_1", "comments:mk_1"], "the thread is hidden with the pin");
});

test("softDeleteMarkup: a resolved thread is withdrawable however many spoke", async () => {
  const service = editing(
    markupRow({ resolved_at: AT }),
    store({
      commentAuthorsForMarkup: async () => [
        { id: "mkc_1", created_by_id: "usr_a" },
        { id: "mkc_2", created_by_id: "usr_b" },
      ],
      softDeleteMarkup: async () => markupRow({ version: 4, deleted_at: AT }),
    }),
  );

  assert.deepEqual(await service.softDeleteMarkup("mk_1", "usr_a", 3), { ok: true });
});

test("softDeleteMarkup: a stale version is rejected before the thread is read", async () => {
  let read = false;
  const service = editing(
    markupRow({ version: 4 }),
    store({
      commentAuthorsForMarkup: async () => {
        read = true;
        return [];
      },
    }),
  );

  await assert.rejects(service.softDeleteMarkup("mk_1", "usr_a", 3), /changed since you loaded it/i);
  assert.equal(read, false);
});

test("restoreMarkup: the pin and its thread come back together", async () => {
  const restored: string[] = [];
  const audit = recorder();
  const service = editing(
    markupRow({ deleted_at: AT, version: 4 }),
    store({
      restoreMarkup: async (id, version) => {
        restored.push(`${id}@${version}`);
        return markupRow({ version: 5 });
      },
      restoreCommentsForMarkup: async (markupId) => {
        restored.push(`comments:${markupId}`);
        return 2;
      },
    }),
    audit,
  );

  const markup = await service.restoreMarkup("mk_1", "usr_a");
  assert.deepEqual(restored, ["mk_1@4", "comments:mk_1"]);
  assert.equal(markup.id, "mk_1");
  assert.equal(audit.entries[0]?.["action"], "markup_restore");
});
