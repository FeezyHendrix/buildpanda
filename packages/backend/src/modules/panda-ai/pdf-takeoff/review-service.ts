import { generateId } from "../../../lib/ids.ts";
import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import { preconRepository, type PreconRepository, type RerunToken } from "./repository.ts";
import { fillDwgIn } from "./dwg-fill.ts";
import { nextRevision } from "./revisions.ts";
import type {
  DwgTakeoffHandover,
  PreconSession,
  PreconSessionRow,
  PreconSheet,
  PreconSheetRow,
  SessionLayerMap,
  SheetBounds,
  StructureContext,
  TakeoffScope,
  UpdateLayerMapBody,
  UpdateSheetBody,
  UpdateStructureBody,
} from "./types.ts";
import { FULL_TAKEOFF_SCOPE, SHEET_KIND } from "./types.ts";
import { assertDimensionChangeIsSafe } from "./sheet-dimension-guard.ts";
import { normaliseViewports } from "./viewports.ts";

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
  toSession: (r: PreconSessionRow) => PreconSession;
  toSheet: (r: PreconSheetRow) => PreconSheet;
}

const db_json = (scope: TakeoffScope): TakeoffScope => ({ kind: scope.kind, elements: [...scope.elements] });

/**
 * The review-side corrections: what the engine read off a sheet, what it took
 * the building to be, and the DWG path landing as a session. Split from the
 * main service so each file stays readable; the main service spreads these in.
 */
export function reviewService({ repo, audit, toSession, toSheet }: Deps) {
  return {
    // A DWG read by the automated take-off lands as a reviewable session, the
    // same object a PDF produces, instead of being appended to the proposal bill.
    // The session exists before the DWG engine runs so the user lands on the
    // take-off page immediately and watches it fill, exactly as with a PDF.
    async createDwgSessionShell(
      orgId: string,
      userId: string,
      proposalId: string,
      planId: string | null,
      file: { fileName: string; storagePath: string },
    ): Promise<PreconSession> {
      const lineage = await nextRevision(repo, planId, FULL_TAKEOFF_SCOPE, "ai");
      const session = await repo.insertSession({
        id: generateId("pcs"),
        org_id: orgId,
        project_id: null,
        proposal_id: proposalId,
        status: "generating",
        title: file.fileName,
        error: null,
        phase: "reading",
        progress_log: [{ at: new Date().toISOString(), phase: "reading", message: `Queued the automated take-off for ${file.fileName}` }],
        scope: db_json(FULL_TAKEOFF_SCOPE),
        plan_id: planId,
        takeoff_kind: "dwg",
        revision: lineage.revision,
        superseded_by: null,
        created_by: userId,
      });
      await repo.supersedeSessions(lineage.supersedes, session.id);
      await repo.insertSheets([
        {
          id: generateId("pcsh"),
          session_id: session.id,
          file_name: file.fileName,
          storage_path: file.storagePath,
          page_number: 1,
          code: "DWG-01",
          title: file.fileName,
          kind: SHEET_KIND.FLOOR_PLAN,
          status: "pending",
          scale_mm_per_pt: null,
          scale_confidence: null,
          dim_unit: null,
          snap_index: null,
          geo_summary: null,
          bounds: null,
          error: "Reading the DWG model space; the drawing register replaces this placeholder when the take-off finishes.",
        },
      ]);
      await repo.upsertSettings({ session_id: session.id, prelims_pct: 5, contingency_pct: 5, vat_pct: 7.5 });
      await audit(session.id, null, userId, "session_created", null, { title: file.fileName, origin: "dwg" });
      return toSession(session);
    },

    // The engine's register and lines land in the shell: one sheet per drawing
    // with its window into the model space, one bill, one row per line with
    // the handles it was computed from, and the session moves to review. A
    // re-run (after the reviewer corrected the layer map) replaces the
    // engine's unverified rows and the register; verified and hand-entered
    // rows stay. In sheets-only mode (a take-off measured by hand) the
    // register lands with every drawing open for measuring and no rows at all.
    // The reading is already in hand when this is called — the DWG parse and
    // any vision call happened in the job, deliberately OUTSIDE the lock. What
    // is left is destructive and fast, so all of it commits as one unit against
    // the session lock, and only if the re-run it belongs to is still the
    // current one. A straggler from a superseded request, or a redelivery of a
    // result that already landed, is refused here before a single row moves —
    // which is what stops the same drafted lines being inserted twice.
    async fillDwgSession(
      sessionId: string,
      file: { fileName: string },
      handover: DwgTakeoffHandover,
      opts: { sheetsOnly?: boolean; token?: RerunToken } = {},
    ): Promise<PreconSession> {
      const token = opts.token ?? (await repo.beginRerun(sessionId));
      const filled = await repo.applyRerun(token, (trx) =>
        fillDwgIn(preconRepository(trx), sessionId, file, handover, opts),
      );
      return toSession(filled);
    },

    async failDwgSession(sessionId: string, message: string): Promise<void> {
      await repo.updateSessionStatus(sessionId, "failed", message);
    },

    // Kept for callers that have the result in hand (tests, one-shot imports).
    async createDwgSession(
      orgId: string,
      userId: string,
      proposalId: string,
      planId: string | null,
      file: { fileName: string; storagePath: string },
      handover: DwgTakeoffHandover,
    ): Promise<PreconSession> {
      const shell = await this.createDwgSessionShell(orgId, userId, proposalId, planId, file);
      return this.fillDwgSession(shell.id, file, handover);
    },

    // The reviewer corrects which element a layer holds; the stored map is
    // what the next measure honours. The caller queues that measure.
    async updateLayerMap(sessionId: string, body: UpdateLayerMapBody, actor: string): Promise<PreconSession> {
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      if (session.takeoff_kind !== "dwg") throw new BadRequestError("Only a DWG take-off has a layer map");
      if (session.status === "generating") throw new BadRequestError("The take-off is still running");
      const before = session.layer_map ?? null;
      await repo.updateSessionLayerMap(session.id, body.layerMap);
      await repo.updateSessionStatus(session.id, "generating");
      await repo.appendSessionProgress(session.id, {
        at: new Date().toISOString(),
        phase: "reading",
        message: "Re-measuring with the corrected layer map",
      });
      await audit(session.id, null, actor, "layer_map_updated", before ? { layerMap: before } : null, { layerMap: body.layerMap });
      const updated = await repo.sessionById(session.id);
      return toSession(updated ?? session);
    },

    // What a DWG re-run needs: the stored file and the map to measure with.
    async dwgRerunContext(sessionId: string): Promise<{ fileName: string; storagePath: string; layerMap: SessionLayerMap | null } | null> {
      const session = await repo.sessionById(sessionId);
      if (!session || session.takeoff_kind !== "dwg") return null;
      const sheet = (await repo.sheetsBySession(session.id))[0];
      if (!sheet) return null;
      return { fileName: sheet.file_name, storagePath: sheet.storage_path, layerMap: session.layer_map ?? null };
    },

    // Sheet lookup for file-serving routes: proves the org owns it and hands
    // back the storage path the DTO deliberately hides, plus the sheet's window.
    async getSheetForOrg(
      sheetId: string,
      orgId: string,
    ): Promise<{ id: string; fileName: string; storagePath: string; bounds: SheetBounds | null } | null> {
      const sheet = await repo.sheetById(sheetId);
      if (!sheet) return null;
      const session = await repo.sessionById(sheet.session_id);
      if (!session || session.org_id !== orgId) return null;
      return { id: sheet.id, fileName: sheet.file_name, storagePath: sheet.storage_path, bounds: sheet.bounds ?? null };
    },

    // The reviewer corrects what the engine read off a sheet. A typed or drawn
    // scale is authoritative (confidence 1), so the next re-measure uses it.
    async updateSheet(sheetId: string, body: UpdateSheetBody, actor: string): Promise<PreconSheet> {
      const sheet = await repo.sheetById(sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      await assertDimensionChangeIsSafe(repo, sheet, body);
      const patch: Parameters<PreconRepository["updateSheet"]>[1] = {};
      if (body.kind !== undefined) patch.kind = body.kind;
      if (body.title !== undefined) patch.title = body.title;
      if (body.scaleMmPerPt !== undefined) {
        if (body.scaleMmPerPt !== null && !(body.scaleMmPerPt > 0)) throw new BadRequestError("Scale must be a positive number");
        patch.scale_mm_per_pt = body.scaleMmPerPt;
        patch.scale_confidence = body.scaleMmPerPt === null ? null : 1;
        patch.error = null;
        if (body.scaleMmPerPt !== null && sheet.status === "unmeasurable") patch.status = "measured";
      }
      if (body.dimUnit !== undefined) patch.dim_unit = body.dimUnit;
      // a details sheet's viewports are replaced whole: what the reviewer drew is the set
      if (body.viewports !== undefined) patch.viewports = normaliseViewports(body.viewports);
      await repo.updateSheet(sheetId, patch);
      await audit(
        sheet.session_id,
        null,
        actor,
        "sheet_updated",
        { kind: sheet.kind, scale: sheet.scale_mm_per_pt, viewports: sheet.viewports ?? [] },
        { ...body, ...(patch.viewports ? { viewports: patch.viewports } : {}) },
      );
      const updated = await repo.sheetById(sheetId);
      return toSheet(updated ?? { ...sheet, ...patch });
    },

    async assertRemeasurable(sheetId: string): Promise<string> {
      const sheet = await repo.sheetById(sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      if (!/\.pdf$/i.test(sheet.file_name)) throw new BadRequestError("Only PDF sheets can be re-measured");
      return sheet.session_id;
    },

    // A person overriding the structure reading makes it high-confidence; the
    // engine's signals are kept so the audit trail shows what it saw.
    async updateStructure(sessionId: string, body: UpdateStructureBody, actor: string): Promise<PreconSession> {
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      const current: StructureContext = session.structure_context ?? {
        structureClass: "unknown",
        buildingType: null,
        storeys: null,
        structuralSystem: "unknown",
        foundationType: "unknown",
        confidence: "low",
        signals: [],
      };
      const next: StructureContext = {
        ...current,
        ...body,
        confidence: "high",
        signals: [...current.signals, `set by reviewer ${new Date().toISOString().slice(0, 10)}`],
      };
      await repo.updateSessionStructure(sessionId, next);
      await audit(sessionId, null, actor, "structure_updated", { ...current }, { ...next });
      const updated = await repo.sessionById(sessionId);
      return toSession(updated ?? session);
    },

    async assertRedraftable(sessionId: string): Promise<void> {
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      if (session.status !== "reviewing") throw new BadRequestError("Only a take-off in review can be redrafted");
      if (!session.structure_context) throw new BadRequestError("Set the structure reading before redrafting");
    },

    // A failed run is retried in place: the session keeps its id, settings and
    // audit trail, and goes back to the queue as if freshly uploaded. Only
    // sessions that actually have drawings can be re-run — a hand-priced
    // sheet has nothing to generate.
    async retryGeneration(sessionId: string, actor: string): Promise<PreconSession> {
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      if (session.status !== "failed") throw new BadRequestError("Only a failed take-off can be retried");
      const sheets = await repo.sheetsBySession(sessionId);
      if (sheets.length === 0) throw new BadRequestError("This sheet has no drawings to measure");
      await repo.resetSessionForRetry(sessionId);
      await audit(sessionId, null, actor, "session_retried", { error: session.error }, null);
      const reset = await repo.sessionById(sessionId);
      return toSession(reset ?? { ...session, status: "generating", error: null, phase: null, progress_log: null });
    },

    async linkToProposal(sessionId: string, proposalId: string) {
      await repo.linkSessionToProposal(sessionId, proposalId);
    },

  };
}
