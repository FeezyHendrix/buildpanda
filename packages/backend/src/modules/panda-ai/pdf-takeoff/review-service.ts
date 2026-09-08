import { generateId } from "../../../lib/ids.ts";
import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import type { PreconRepository } from "./repository.ts";
import type {
  DwgTakeoffLine,
  PreconBoqRowRow,
  PreconSession,
  PreconSessionRow,
  PreconSheet,
  PreconSheetRow,
  StructureContext,
  TakeoffScope,
  UpdateSheetBody,
  UpdateStructureBody,
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
  toSession: (r: PreconSessionRow) => PreconSession;
  toSheet: (r: PreconSheetRow) => PreconSheet;
}

const db_json = (scope: TakeoffScope): TakeoffScope => ({ kind: scope.kind, elements: [...scope.elements] });

// Shape a DWG take-off line into a bill row with everything review expects.
function dwgRow(
  billId: string,
  sort: number,
  seed: Partial<Omit<PreconBoqRowRow, "id" | "bill_id" | "sort" | "created_at" | "updated_at">> & {
    row_type: PreconBoqRowRow["row_type"];
    description: string;
  },
): Omit<PreconBoqRowRow, "created_at" | "updated_at"> {
  return {
    id: generateId("pbr"),
    bill_id: billId,
    sort,
    row_type: seed.row_type,
    element_group: seed.element_group ?? null,
    code: seed.code ?? null,
    description: seed.description,
    unit: seed.unit ?? null,
    qty_gross: seed.qty_gross ?? null,
    deductions: [],
    qty: seed.qty ?? null,
    rate: null,
    amount: null,
    rate_source: null,
    confidence: seed.confidence ?? null,
    status: seed.status ?? null,
    version: 1,
    measurement_basis: seed.measurement_basis ?? null,
    confidence_reason: seed.confidence_reason ?? null,
    provenance: seed.provenance ?? null,
    origin: "ai",
    edited_at: null,
    edited_by: null,
    verified_by: null,
    verified_at: null,
  };
}


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
        created_by: userId,
      });
      await repo.insertSheets([
        {
          id: generateId("pcsh"),
          session_id: session.id,
          file_name: file.fileName,
          storage_path: file.storagePath,
          page_number: 1,
          code: "DWG-01",
          title: file.fileName,
          kind: "floor-plan",
          status: "unmeasurable",
          scale_mm_per_pt: null,
          scale_confidence: null,
          dim_unit: null,
          snap_index: null,
          error: "Read by the automated take-off; no vector overlay for DWG yet",
        },
      ]);
      await repo.upsertSettings({ session_id: session.id, prelims_pct: 5, contingency_pct: 5, vat_pct: 7.5 });
      await audit(session.id, null, userId, "session_created", null, { title: file.fileName, origin: "dwg" });
      return toSession(session);
    },

    // The engine's lines land in the shell: one bill, one row per line, and the
    // session moves to review.
    async fillDwgSession(sessionId: string, file: { fileName: string }, lines: DwgTakeoffLine[]): Promise<PreconSession> {
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      const bill = await repo.insertBill({
        id: generateId("pbl"),
        session_id: session.id,
        title: "Bill No. 1 — Automated take-off (DWG)",
        sort: 0,
      });
      const rows: Omit<PreconBoqRowRow, "created_at" | "updated_at">[] = [];
      const byTrade = new Map<string, DwgTakeoffLine[]>();
      for (const line of lines) {
        const list = byTrade.get(line.trade);
        if (list) list.push(line);
        else byTrade.set(line.trade, [line]);
      }
      for (const [trade, tradeLines] of byTrade) {
        rows.push(dwgRow(bill.id, rows.length, { row_type: "heading", element_group: trade, description: trade.toUpperCase() }));
        for (const line of tradeLines) {
          const low = line.confidence !== "high";
          rows.push(
            dwgRow(bill.id, rows.length, {
              row_type: "item",
              element_group: trade,
              description: line.description,
              unit: line.unit,
              qty_gross: line.quantity,
              qty: line.quantity,
              confidence: low ? "low" : "high",
              status: low ? "needs_review" : "ai_generated",
              measurement_basis: line.basis,
              confidence_reason: line.confidence === "medium" ? "medium confidence" : low ? "low confidence" : null,
              provenance: `Read from ${file.fileName} by the automated take-off: ${line.basis}`,
            }),
          );
        }
      }
      await repo.insertBoqRows(rows);
      await repo.appendSessionProgress(session.id, {
        at: new Date().toISOString(),
        phase: "draft",
        message: `Read ${lines.length} lines from ${file.fileName}`,
      });
      await repo.updateSessionStatus(session.id, "reviewing");
      const updated = await repo.sessionById(session.id);
      return toSession(updated ?? { ...session, status: "reviewing" });
    },

    async failDwgSession(sessionId: string, message: string): Promise<void> {
      await repo.updateSessionStatus(sessionId, "failed", message);
    },

    // Kept for callers that have the lines in hand (tests, one-shot imports).
    async createDwgSession(
      orgId: string,
      userId: string,
      proposalId: string,
      planId: string | null,
      file: { fileName: string; storagePath: string },
      lines: DwgTakeoffLine[],
    ): Promise<PreconSession> {
      const shell = await this.createDwgSessionShell(orgId, userId, proposalId, planId, file);
      return this.fillDwgSession(shell.id, file, lines);
    },

    // The reviewer corrects what the engine read off a sheet. A typed or drawn
    // scale is authoritative (confidence 1), so the next re-measure uses it.
    async updateSheet(sheetId: string, body: UpdateSheetBody, actor: string): Promise<PreconSheet> {
      const sheet = await repo.sheetById(sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
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
      await repo.updateSheet(sheetId, patch);
      await audit(sheet.session_id, null, actor, "sheet_updated", { kind: sheet.kind, scale: sheet.scale_mm_per_pt }, { ...body });
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
