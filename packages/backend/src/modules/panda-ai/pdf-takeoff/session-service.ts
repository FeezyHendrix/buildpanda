import { generateId } from "../../../lib/ids.ts";
import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import type { PreconRepository } from "./repository.ts";
import { computeSummary, db_json, toBill, toGeometry, toRowsWithMeasurement, toSession, toSheet } from "./dto.ts";
import { lineageKindOf, nextRevision } from "./revisions.ts";
import { withStale, type StaleLookup } from "./stale.ts";
import type {
  PreconBill,
  PreconSession,
  PreconSessionRow,
  PreconSnapshot,
  PreconSummarySettings,
  TakeoffKind,
  TakeoffScope,
} from "./types.ts";
import { FULL_TAKEOFF_SCOPE } from "./types.ts";

type Audit = (
  sessionId: string,
  rowId: string | null,
  actor: string,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) => Promise<void>;

interface Deps {
  repo: PreconRepository;
  audit: Audit;
  staleLookup: StaleLookup;
}

/**
 * The session itself: how it is opened, listed and snapshotted, which org may
 * touch it, the bills hanging off it and the percentages its summary uses.
 * Split from the main service so each file stays readable.
 */
export function sessionService({ repo, audit, staleLookup }: Deps) {
  return {
    async createSession(
      orgId: string,
      title: string,
      userId: string,
      files: { fileName: string; storagePath: string }[],
      proposalId: string | null = null,
      scope: TakeoffScope = FULL_TAKEOFF_SCOPE,
      origin: { planId?: string | null; takeoffKind?: TakeoffKind } = {},
    ) {
      if (scope.kind === "sections" && scope.elements.length === 0) {
        throw new BadRequestError("Pick at least one section to measure");
      }
      const lineage = await nextRevision(repo, origin.planId ?? null, scope, lineageKindOf(origin.takeoffKind));
      const session = await repo.insertSession({
        id: generateId("pcs"),
        org_id: orgId,
        project_id: null,
        proposal_id: proposalId,
        status: "uploading",
        title,
        error: null,
        phase: null,
        progress_log: null,
        scope: db_json(scope),
        plan_id: origin.planId ?? null,
        takeoff_kind: origin.takeoffKind ?? "pdf",
        revision: lineage.revision,
        superseded_by: null,
        created_by: userId,
      });
      await repo.supersedeSessions(lineage.supersedes, session.id);
      // One placeholder sheet per file; the generate job expands PDFs into per-page sheets.
      await repo.insertSheets(
        files.map((f, i) => ({
          id: generateId("pcsh"),
          session_id: session.id,
          file_name: f.fileName,
          storage_path: f.storagePath,
          page_number: i + 1,
          code: null,
          title: null,
          kind: "unknown" as const,
          status: "pending" as const,
          scale_mm_per_pt: null,
          scale_confidence: null,
          dim_unit: null,
          snap_index: null,
          geo_summary: null,
          error: null,
        })),
      );
      await repo.upsertSettings({ session_id: session.id, prelims_pct: 5, contingency_pct: 5, vat_pct: 7.5 });
      await audit(session.id, null, userId, "session_created", null, { title, scope });
      return toSession(session);
    },

    // Priced by hand: with no drawings there is nothing to upload or generate,
    // so the session opens directly in review.
    async createBlankSession(orgId: string, title: string, userId: string, proposalId: string | null = null) {
      const session = await repo.insertSession({
        id: generateId("pcs"),
        org_id: orgId,
        project_id: null,
        proposal_id: proposalId,
        status: "reviewing",
        title,
        error: null,
        phase: null,
        progress_log: null,
        scope: db_json(FULL_TAKEOFF_SCOPE),
        plan_id: null,
        takeoff_kind: "manual",
        created_by: userId,
      });
      await repo.insertBill({
        id: generateId("pcb"),
        session_id: session.id,
        title: "Bill No. 1",
        sort: 0,
      });
      await repo.upsertSettings({ session_id: session.id, prelims_pct: 5, contingency_pct: 5, vat_pct: 7.5 });
      await audit(session.id, null, userId, "session_created", null, { title, origin: "manual" });
      return toSession(session);
    },

    async listSessions(orgId: string, proposalId?: string) {
      const rows = await repo.sessionsByOrg(orgId, proposalId);
      const counts = await repo.lineCountsForSessions(rows.map((r: PreconSessionRow) => r.id));
      const sessions = rows.map((r: PreconSessionRow): PreconSession => ({ ...toSession(r), lines: counts.get(r.id) ?? { total: 0, verified: 0, attention: 0 } }));
      return withStale(sessions, staleLookup);
    },

    // Every sales-suite access path must prove the session belongs to the
    // caller's active organization before touching its data.
    async assertSessionOrg(sessionId: string, orgId: string) {
      const session = await repo.sessionById(sessionId);
      if (!session || session.org_id !== orgId) throw new NotFoundError("Preconstruction session");
      return toSession(session);
    },

    async assertRowOrg(rowId: string, orgId: string) {
      const sessionId = await repo.sessionIdForRow(rowId);
      if (!sessionId) throw new NotFoundError("BOQ row");
      const session = await repo.sessionById(sessionId);
      if (!session || session.org_id !== orgId) throw new NotFoundError("BOQ row");
      return sessionId;
    },

    async assertSheetOrg(sheetId: string, orgId: string) {
      const sheet = await repo.sheetById(sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      const session = await repo.sessionById(sheet.session_id);
      if (!session || session.org_id !== orgId) throw new NotFoundError("Sheet");
      return sheet.session_id;
    },

    async assertBillOrg(billId: string, orgId: string) {
      const bill = await repo.billById(billId);
      if (!bill) throw new NotFoundError("Bill");
      const session = await repo.sessionById(bill.session_id);
      if (!session || session.org_id !== orgId) throw new NotFoundError("Bill");
      return bill.session_id;
    },

    async assertProgrammeTaskOrg(taskId: string, orgId: string) {
      const task = await repo.programmeTaskById(taskId);
      if (!task) throw new NotFoundError("Programme task");
      const session = await repo.sessionById(task.session_id);
      if (!session || session.org_id !== orgId) throw new NotFoundError("Programme task");
      return task.session_id;
    },

    async getSnapshot(sessionId: string): Promise<PreconSnapshot> {
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      const [sheets, bills, rowRows, geometries, settingsRow, statusCounts] = await Promise.all([
        repo.sheetsBySession(sessionId),
        repo.billsBySession(sessionId),
        repo.rowsBySession(sessionId),
        repo.geometriesBySession(sessionId),
        repo.settingsForSession(sessionId),
        repo.rowStatusCounts(sessionId),
      ]);
      const settings: PreconSummarySettings = {
        prelimsPct: Number(settingsRow?.prelims_pct ?? 5),
        contingencyPct: Number(settingsRow?.contingency_pct ?? 5),
        vatPct: Number(settingsRow?.vat_pct ?? 7.5),
      };
      const rows = toRowsWithMeasurement(rowRows, geometries);
      const total = statusCounts.reduce((s, c) => s + c.count, 0);
      const verified = statusCounts.find((c) => c.status === "verified")?.count ?? 0;
      return {
        session: (await withStale([toSession(session)], staleLookup))[0]!,
        sheets: sheets.map(toSheet),
        bills: bills.map(toBill),
        rows,
        geometries: geometries.map(toGeometry),
        settings,
        summary: computeSummary(rows, settings),
        progress: { total, verified },
      };
    },

    async createBill(sessionId: string, title: string, actor: string): Promise<PreconBill> {
      const bill = await repo.insertBill({
        id: generateId("pcb"),
        session_id: sessionId,
        title,
        sort: await repo.nextBillSort(sessionId),
      });
      await audit(sessionId, null, actor, "bill_created", null, { billId: bill.id, title });
      return toBill(bill);
    },

    async renameBill(billId: string, title: string, actor: string): Promise<PreconBill> {
      const existing = await repo.billById(billId);
      if (!existing) throw new NotFoundError("Bill");
      const updated = await repo.updateBill(billId, { title });
      if (!updated) throw new NotFoundError("Bill");
      await audit(existing.session_id, null, actor, "bill_renamed", { title: existing.title }, { title });
      return toBill(updated);
    },

    async removeBill(billId: string, actor: string): Promise<{ ok: true }> {
      const existing = await repo.billById(billId);
      if (!existing) throw new NotFoundError("Bill");
      const bills = await repo.billsBySession(existing.session_id);
      if (bills.length <= 1) throw new BadRequestError("A pricing sheet needs at least one bill");
      await repo.deleteBill(billId);
      await audit(existing.session_id, null, actor, "bill_deleted", { title: existing.title }, null);
      return { ok: true };
    },

    async exportWorkbook(sessionId: string): Promise<{ fileName: string; buffer: Buffer }> {
      const [snapshot, projectName] = await Promise.all([
        this.getSnapshot(sessionId),
        repo.projectNameForSession(sessionId),
      ]);
      const { buildBoqWorkbookBuffer } = await import("./export.ts");
      const buffer = await buildBoqWorkbookBuffer(snapshot, projectName ?? snapshot.session.title);
      const safeTitle = snapshot.session.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
      return { fileName: `BOQ-${safeTitle}.xlsx`, buffer };
    },

    async updateSettings(sessionId: string, patch: Partial<PreconSummarySettings>, actor: string) {
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      const current = await repo.settingsForSession(sessionId);
      const next = {
        session_id: sessionId,
        prelims_pct: patch.prelimsPct ?? Number(current?.prelims_pct ?? 5),
        contingency_pct: patch.contingencyPct ?? Number(current?.contingency_pct ?? 5),
        vat_pct: patch.vatPct ?? Number(current?.vat_pct ?? 7.5),
      };
      await repo.upsertSettings(next);
      await audit(sessionId, null, actor, "settings_updated", null, { ...patch });
      return { prelimsPct: next.prelims_pct, contingencyPct: next.contingency_pct, vatPct: next.vat_pct };
    },
  };
}
