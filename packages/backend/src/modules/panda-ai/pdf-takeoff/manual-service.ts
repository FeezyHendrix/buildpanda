import { generateId } from "../../../lib/ids.ts";
import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import type { PreconRepository } from "./repository.ts";
import { nextRevision } from "./revisions.ts";
import { PICTURE_PLAN } from "./types.ts";
import { buildTakeoffCsv, csvFileName } from "./export-csv.ts";
import { manualBasis, measureVertices, netQuantity, normaliseTypical, quantityFromStated } from "./measurements.ts";
import { scaleAt, scaleClause } from "./viewports.ts";
import type {
  CreateMeasurementBody,
  CreateMeasurementResult,
  ManualQuantity,
  PreconBillRow,
  PreconBoqRowDto,
  PreconBoqRowRow,
  PreconGeometry,
  PreconGeometryRow,
  PreconSession,
  PreconSessionRow,
  PreconSnapshot,
  StatedMeasurementBody,
  TakeoffScope,
} from "./types.ts";
import type { PublishFn } from "./service.ts";

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
  publish: PublishFn;
  toSession: (r: PreconSessionRow) => PreconSession;
  toRow: (r: PreconBoqRowRow) => PreconBoqRowDto;
  toGeometry: (r: PreconGeometryRow) => PreconGeometry;
  snapshot: (sessionId: string) => Promise<PreconSnapshot>;
}

export const MANUAL_BILL_TITLE = "Bill No. 1 — Measured by hand";

const db_json = (scope: TakeoffScope): TakeoffScope => ({ kind: scope.kind, elements: [...scope.elements] });

interface ManualLine {
  description: string;
  elementGroup: string;
  code?: string;
  unit: string;
  // the drawn or stated figure after the tool's factor; net = gross × typical
  gross: number;
  typical: number;
  rate?: number;
  basis: string;
  provenance: string;
}

/**
 * A take-off measured by hand is the same session, bill, evidence and
 * revisions as an AI one; only the lines come from a person. This factory
 * holds that path: the manual session, the drawn or stated line, and the
 * CSV that lists what was measured. The main service spreads it in.
 */
export function manualService({ repo, audit, publish, toSession, toRow, toGeometry, snapshot }: Deps) {
  async function targetBill(sessionId: string, billId?: string): Promise<PreconBillRow> {
    if (billId) {
      const bill = await repo.billById(billId);
      if (!bill || bill.session_id !== sessionId) throw new NotFoundError("Bill");
      return bill;
    }
    const [first] = await repo.billsBySession(sessionId);
    return first ?? repo.insertBill({ id: generateId("pbl"), session_id: sessionId, title: MANUAL_BILL_TITLE, sort: 0 });
  }

  // A person drew or stated it, so it lands verified by that person; the rate
  // is theirs too, not a rate card's.
  async function insertManualLine(bill: PreconBillRow, line: ManualLine, actor: string): Promise<PreconBoqRowRow> {
    const rate = line.rate ?? null;
    const qty = netQuantity(line.gross, [], line.typical);
    return repo.insertBoqRow({
      id: generateId("pbr"),
      bill_id: bill.id,
      sort: await repo.nextRowSort(bill.id),
      row_type: "item",
      element_group: line.elementGroup,
      code: line.code ?? null,
      description: line.description,
      unit: line.unit,
      qty_gross: line.gross,
      deductions: [],
      typical: line.typical,
      qty,
      rate,
      amount: rate === null ? null : Math.round(qty * rate * 100) / 100,
      rate_source: rate === null ? null : "manual",
      confidence: "high",
      status: "verified",
      version: 1,
      measurement_basis: line.basis,
      confidence_reason: null,
      provenance: line.provenance,
      origin: "manual",
      edited_at: null,
      edited_by: null,
      verified_by: actor,
      verified_at: new Date(),
    });
  }

  function announce(sessionId: string, row: PreconBoqRowRow, actor: string, extra: Record<string, unknown>): void {
    publish(sessionId, {
      type: "row.created",
      sessionId,
      rowId: row.id,
      version: row.version,
      actor,
      changes: { billId: row.bill_id, description: row.description, qty: Number(row.qty), rate: row.rate === null ? null : Number(row.rate), ...extra },
    });
  }

  const unitFor = (body: { unit?: string }, q: ManualQuantity): string => body.unit?.trim() || q.unit;

  return {
    // The sheets are rendered by the same jobs an AI take-off uses, in
    // sheets-only mode; the bill starts empty and waits for the first line.
    async createManualSession(
      orgId: string,
      userId: string,
      proposalId: string,
      planId: string,
      file: { fileName: string; storagePath: string },
      scope: TakeoffScope,
    ): Promise<PreconSession> {
      const isDwg = /\.dwg$/i.test(file.fileName);
      // a picture needs no rendering job: it is the sheet, ready now, unscaled
      const isPicture = PICTURE_PLAN.test(file.fileName);
      const lineage = await nextRevision(repo, planId, scope, "manual");
      const session = await repo.insertSession({
        id: generateId("pcs"),
        org_id: orgId,
        project_id: null,
        proposal_id: proposalId,
        status: isPicture ? "reviewing" : "generating",
        title: file.fileName,
        error: null,
        phase: isPicture ? null : "reading",
        progress_log: [
          {
            at: new Date().toISOString(),
            phase: "reading",
            message: isPicture ? `${file.fileName} is a picture: set its scale from two known points, then measure` : `Preparing ${file.fileName} for measuring by hand`,
          },
        ],
        scope: db_json(scope),
        plan_id: planId,
        takeoff_kind: "manual",
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
          code: isDwg ? "DWG-01" : isPicture ? "IMG-01" : null,
          title: isDwg || isPicture ? file.fileName : null,
          kind: isDwg ? "floor-plan" : "unknown",
          status: isPicture ? "measured" : "pending",
          scale_mm_per_pt: null,
          scale_confidence: null,
          dim_unit: null,
          snap_index: null,
          geo_summary: null,
          bounds: null,
          error: null,
        },
      ]);
      await repo.insertBill({ id: generateId("pbl"), session_id: session.id, title: MANUAL_BILL_TITLE, sort: 0 });
      await repo.upsertSettings({ session_id: session.id, prelims_pct: 5, contingency_pct: 5, vat_pct: 7.5 });
      await audit(session.id, null, userId, "session_created", null, { title: file.fileName, scope, origin: "manual" });
      return toSession(session);
    },

    // What a sheets-only DWG read needs: the file behind a manual session.
    async sheetsOnlyDwgContext(sessionId: string): Promise<{ fileName: string; storagePath: string } | null> {
      const session = await repo.sessionById(sessionId);
      if (!session || session.takeoff_kind !== "manual") return null;
      const sheet = (await repo.sheetsBySession(sessionId))[0];
      if (!sheet || !/\.dwg$/i.test(sheet.file_name)) return null;
      return { fileName: sheet.file_name, storagePath: sheet.storage_path };
    },

    // A line drawn on a sheet: the geometry is the evidence, the sheet's
    // scale gives the number, and the basis states every factor applied.
    async createMeasurement(sessionId: string, body: CreateMeasurementBody, actor: string): Promise<CreateMeasurementResult> {
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      const sheet = await repo.sheetById(body.sheetId);
      if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
      if (!body.description.trim()) throw new BadRequestError("Give the line a description");
      const typical = normaliseTypical(body.typical);
      // the viewport under the first vertex sets the scale, else the sheet does
      const pick = scaleAt(sheet, body.vertices);
      const q = measureVertices(body.tool, body.vertices, pick.mmPerPt, body.factor);
      const unit = unitFor(body, q);
      const sheetCode = sheet.code ?? sheet.title ?? sheet.file_name;
      const bill = await targetBill(sessionId, body.billId);
      const row = await insertManualLine(
        bill,
        {
          description: body.description.trim(),
          elementGroup: body.elementGroup,
          code: body.code,
          unit,
          gross: q.gross,
          typical,
          rate: body.rate,
          basis: manualBasis(body.tool, q, `on ${sheetCode}${scaleClause(sheet, pick)}`, body.factor, typical, unit),
          provenance: `Measured by hand on ${sheetCode} by ${actor}`,
        },
        actor,
      );
      const geometry: Omit<PreconGeometryRow, "created_at"> = {
        id: generateId("pgeo"),
        row_id: row.id,
        sheet_id: sheet.id,
        kind: q.geometryKind,
        vertices: body.vertices,
        source: "manual",
        quantity: q.base,
        unit: q.baseUnit,
      };
      await repo.insertGeometries([geometry]);
      await audit(sessionId, row.id, actor, "measured_by_hand", null, {
        tool: body.tool,
        sheetId: sheet.id,
        qty: Number(row.qty),
        unit,
        typical,
        basis: row.measurement_basis,
      });
      announce(sessionId, row, actor, { tool: body.tool, sheetId: sheet.id });
      return { row: toRow(row), geometry: toGeometry({ ...geometry, created_at: new Date() }) };
    },

    // A quantity given in words ("add 12 m of 225 wall at 2.7 m high"): no
    // drawing, so no geometry, and the basis says the figure was stated.
    async createStatedMeasurement(sessionId: string, body: StatedMeasurementBody, actor: string): Promise<PreconBoqRowDto> {
      const session = await repo.sessionById(sessionId);
      if (!session) throw new NotFoundError("Preconstruction session");
      if (!body.description.trim()) throw new BadRequestError("Give the line a description");
      const typical = normaliseTypical(body.typical);
      const q = quantityFromStated(body.tool, body.qty, body.factor);
      const unit = unitFor(body, q);
      const bill = await targetBill(sessionId, body.billId);
      const row = await insertManualLine(
        bill,
        {
          description: body.description.trim(),
          elementGroup: body.elementGroup,
          code: body.code,
          unit,
          gross: q.gross,
          typical,
          rate: body.rate,
          basis: manualBasis(body.tool, q, "stated in prompt", body.factor, typical, unit),
          provenance: `Stated in a Panda AI prompt by ${actor}`,
        },
        actor,
      );
      await audit(sessionId, row.id, actor, "stated_in_prompt", null, { tool: body.tool, qty: Number(row.qty), unit, basis: row.measurement_basis });
      announce(sessionId, row, actor, { tool: body.tool });
      return toRow(row);
    },

    async exportCsv(sessionId: string): Promise<{ fileName: string; csv: string }> {
      const snap = await snapshot(sessionId);
      return { fileName: csvFileName(snap.session.title), csv: buildTakeoffCsv(snap) };
    },

    // The assembly path (assembly-measure.ts) measures one shape and bills it
    // as several lines through the same bill lookup, insert and announcement.
    manualLine: { targetBill, insert: insertManualLine, announce, audit, toRow, toGeometry },
  };
}
