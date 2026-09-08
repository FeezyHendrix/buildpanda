import { test } from "node:test";
import assert from "node:assert/strict";
import { ANCHOR_CHECK, up } from "../../db/migrations/20260822_markups_on_precon.ts";
import type { DrawingMarkupRepository } from "./repository.ts";
import { anchorOf, drawingMarkupService } from "./service.ts";
import type { DrawingMarkupCommentRow, DrawingMarkupRow, PreconAnchorGuard } from "./types.ts";

const ORG = "org_a";
const OTHER_ORG = "org_b";
const SESSION = "pcs_1";

function preconRow(overrides: Partial<DrawingMarkupRow> = {}): DrawingMarkupRow {
  return {
    id: "mk_1",
    project_id: null,
    document_id: null,
    document_version_id: null,
    page_no: null,
    precon_session_id: SESSION,
    precon_sheet_id: "psh_1",
    precon_row_id: "pbr_1",
    kind: "pin",
    geometry: { kind: "pin", at: { x: 120.5, y: 340 } },
    color: "#004DE7",
    created_by_id: "u_1",
    resolved_at: null,
    resolved_by_id: null,
    created_at: new Date("2026-08-22T09:00:00Z"),
    updated_at: new Date("2026-08-22T09:00:00Z"),
    ...overrides,
  };
}

function projectRow(overrides: Partial<DrawingMarkupRow> = {}): DrawingMarkupRow {
  return preconRow({
    id: "mk_p",
    project_id: "p_1",
    document_id: "doc_1",
    document_version_id: "dv_1",
    page_no: 1,
    precon_session_id: null,
    precon_sheet_id: null,
    precon_row_id: null,
    ...overrides,
  });
}

/** In-memory register: enough of the repository for the service to run end to end. */
function fakeRepo(seed: DrawingMarkupRow[] = []) {
  const markups = new Map(seed.map((r) => [r.id, r]));
  const comments: DrawingMarkupCommentRow[] = [];
  const repo = {
    listBySession: async (sessionId: string, sheetId?: string) =>
      [...markups.values()].filter(
        (r) => r.precon_session_id === sessionId && (sheetId === undefined || r.precon_sheet_id === sheetId),
      ),
    byId: async (id: string) => markups.get(id),
    insertMarkup: async (row: DrawingMarkupRow) => {
      markups.set(row.id, row);
    },
    deleteMarkup: async (id: string) => {
      markups.delete(id);
    },
    resolveMarkup: async (id: string, userId: string | null, resolved: boolean) => {
      const row = markups.get(id)!;
      markups.set(id, { ...row, resolved_at: resolved ? new Date() : null, resolved_by_id: resolved ? userId : null });
    },
    commentsForMarkups: async (ids: readonly string[]) => comments.filter((c) => ids.includes(c.markup_id)),
    insertComment: async (row: DrawingMarkupCommentRow) => {
      comments.push(row);
    },
    usersByIds: async (ids: readonly string[]) => ids.map((id) => ({ id, name: `User ${id}` })),
    versionById: async () => undefined,
    currentVersionIdForDocument: async () => undefined,
    rfiLinksForMarkups: async () => [],
    approvalLinksForMarkups: async () => [],
  } as unknown as DrawingMarkupRepository;
  return { repo, markups, comments };
}

/** Org guard shaped like the pdf-takeoff service: sessions, sheets and rows each know their org. */
function fakeGuard(): PreconAnchorGuard {
  const sessionOrg: Record<string, string> = { [SESSION]: ORG, pcs_2: ORG, pcs_other: OTHER_ORG };
  const sheetSession: Record<string, string> = { psh_1: SESSION, psh_2: "pcs_2", psh_other: "pcs_other" };
  const rowSession: Record<string, string> = { pbr_1: SESSION, pbr_2: "pcs_2" };
  const notFound = (what: string) => Object.assign(new Error(`${what} not found`), { statusCode: 404 });
  return {
    async assertSessionOrg(sessionId, orgId) {
      if (sessionOrg[sessionId] !== orgId) throw notFound("Preconstruction session");
    },
    async assertSheetOrg(sheetId, orgId) {
      const s = sheetSession[sheetId];
      if (!s || sessionOrg[s] !== orgId) throw notFound("Sheet");
      return s;
    },
    async assertRowOrg(rowId, orgId) {
      const s = rowSession[rowId];
      if (!s || sessionOrg[s] !== orgId) throw notFound("BOQ row");
      return s;
    },
  };
}

const pinInput = { sheetId: "psh_1", rowId: "pbr_1", kind: "pin" as const, geometry: { kind: "pin" as const, at: { x: 1, y: 2 } } };

// ── Anchor CHECK ───────────────────────────────────────────────────────────

test("anchorOf mirrors the CHECK: exactly one anchor set", () => {
  assert.equal(anchorOf(projectRow()), "project");
  assert.equal(anchorOf(preconRow()), "precon");
  assert.equal(anchorOf(preconRow({ precon_row_id: null })), "precon", "the bill line is optional");
  assert.throws(() => anchorOf(preconRow({ precon_sheet_id: null })), /exactly one/);
  assert.throws(() => anchorOf(projectRow({ precon_row_id: "pbr_1" })), /exactly one/, "no row link on a project drawing");
  assert.throws(() => anchorOf(preconRow({ project_id: "p_1" })), /exactly one/, "no mixing");
  assert.throws(() => anchorOf(projectRow({ page_no: null })), /exactly one/);
});

test("migration adds the anchor constraint over both column sets", async () => {
  const raws: string[] = [];
  const chain: unknown = new Proxy(() => chain, { get: () => chain, apply: () => chain });
  const knex = Object.assign(async () => undefined, {
    schema: { alterTable: async (_t: string, cb: (t: unknown) => void) => cb(chain) },
    raw: async (sql: string) => {
      raws.push(sql);
    },
  });
  await up(knex as never);
  const constraint = raws.find((s) => s.includes("drawing_markups_anchor_check"));
  assert.ok(constraint, "constraint is added");
  assert.ok(constraint.includes(`CHECK (${ANCHOR_CHECK})`));
  for (const col of ["project_id", "document_id", "document_version_id", "page_no", "precon_session_id", "precon_sheet_id", "precon_row_id"]) {
    assert.ok(ANCHOR_CHECK.includes(`${col} IS NOT NULL`) || col === "precon_row_id", `${col} required on its side`);
    assert.ok(ANCHOR_CHECK.includes(`${col} IS NULL`), `${col} forbidden on the other side`);
  }
});

// ── Org scoping ────────────────────────────────────────────────────────────

test("createForSession writes a precon-anchored pin carrying the bill line", async () => {
  const { repo, markups } = fakeRepo();
  const svc = drawingMarkupService(repo, fakeGuard());
  const markup = await svc.createForSession(SESSION, ORG, "u_1", pinInput);
  assert.equal(markup.preconSessionId, SESSION);
  assert.equal(markup.preconSheetId, "psh_1");
  assert.equal(markup.preconRowId, "pbr_1");
  assert.equal(markup.projectId, null);
  assert.equal(markup.isCurrentRevision, true);
  const stored = [...markups.values()][0]!;
  assert.equal(stored.page_no, null);
  assert.equal(anchorOf(stored), "precon");
});

test("createForSession refuses another org's session, and anchors from other sessions", async () => {
  const svc = drawingMarkupService(fakeRepo().repo, fakeGuard());
  await assert.rejects(svc.createForSession("pcs_other", ORG, "u_1", pinInput), /not found/);
  await assert.rejects(svc.createForSession(SESSION, ORG, "u_1", { ...pinInput, sheetId: "psh_2" }), /Sheet does not belong/);
  await assert.rejects(svc.createForSession(SESSION, ORG, "u_1", { ...pinInput, rowId: "pbr_2" }), /Bill line does not belong/);
  await assert.rejects(svc.createForSession(SESSION, ORG, "u_1", { ...pinInput, sheetId: "psh_other" }), /not found/);
});

test("preconSessionOf gates comments, resolve and delete by the session's org", async () => {
  const { repo } = fakeRepo([preconRow(), projectRow(), preconRow({ id: "mk_other", precon_session_id: "pcs_other", precon_sheet_id: "psh_other" })]);
  const svc = drawingMarkupService(repo, fakeGuard());
  assert.equal(await svc.preconSessionOf("mk_1", ORG), SESSION);
  await assert.rejects(svc.preconSessionOf("mk_1", OTHER_ORG), /not found/);
  await assert.rejects(svc.preconSessionOf("mk_other", ORG), /not found/);
  await assert.rejects(svc.preconSessionOf("mk_p", ORG), /not found/, "project markups are not reachable through precon routes");
  await assert.rejects(svc.preconSessionOf("mk_missing", ORG), /not found/);
});

test("listForSession filters by session and optionally sheet", async () => {
  const { repo } = fakeRepo([preconRow(), preconRow({ id: "mk_2", precon_sheet_id: "psh_1b" }), preconRow({ id: "mk_3", precon_session_id: "pcs_2" })]);
  const svc = drawingMarkupService(repo, fakeGuard());
  assert.deepEqual((await svc.listForSession(SESSION)).map((m) => m.id), ["mk_1", "mk_2"]);
  assert.deepEqual((await svc.listForSession(SESSION, "psh_1b")).map((m) => m.id), ["mk_2"]);
});

// ── Resolve flow ───────────────────────────────────────────────────────────

test("a pin with a comment is open until resolved, and reopens", async () => {
  const { repo } = fakeRepo();
  const svc = drawingMarkupService(repo, fakeGuard());
  const pin = await svc.createForSession(SESSION, ORG, "u_1", pinInput);
  const comment = await svc.addComment(pin.id, "u_2", { body: "  Is this partition 225 or 150? " });
  assert.equal(comment.body, "Is this partition 225 or 150?");
  assert.equal(comment.mediaKind, null);

  const open = (await svc.listForSession(SESSION)).filter((m) => m.resolvedAt === null && m.preconRowId === "pbr_1");
  assert.equal(open.length, 1, "the bill line shows one open comment");

  const resolved = await svc.setResolved(pin.id, "u_1", true);
  assert.ok(resolved.resolvedAt);
  assert.equal(resolved.comments.length, 1, "resolving keeps the thread");
  assert.equal((await svc.listForSession(SESSION)).filter((m) => m.resolvedAt === null).length, 0);

  const reopened = await svc.setResolved(pin.id, "u_1", false);
  assert.equal(reopened.resolvedAt, null);
});

test("service without the precon guard rejects take-off calls loudly", async () => {
  const svc = drawingMarkupService(fakeRepo().repo);
  await assert.rejects(svc.createForSession(SESSION, ORG, "u_1", pinInput), /precon service/);
});
