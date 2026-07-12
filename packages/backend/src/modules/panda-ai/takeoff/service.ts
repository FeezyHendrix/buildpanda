import { ConflictError, NotFoundError, BadRequestError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import type { PreconRepository } from "./repository.ts";
import type {
  AddDeductionBody,
  Deduction,
  PreconRateCardRow,
  PreconRateRow,
  PreconAuditEventRow,
  PreconBill,
  PreconBillRow,
  PreconBoqRowDto,
  PreconBoqRowRow,
  PreconGeometry,
  PreconGeometryRow,
  PreconSession,
  PreconSessionRow,
  PreconSheet,
  PreconSheetRow,
  PreconSnapshot,
  PreconSummary,
  PreconSummarySettings,
  UpdateGeometryBody,
  UpdateRowBody,
} from "./types.ts";

const num = (v: string | number | null): number | null => (v === null ? null : Number(v));

function toSession(r: PreconSessionRow): PreconSession {
  return {
    id: r.id,
    orgId: r.org_id,
    projectId: r.project_id,
    proposalId: r.proposal_id,
    status: r.status,
    title: r.title,
    error: r.error,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

function toSheet(r: PreconSheetRow): PreconSheet {
  return {
    id: r.id,
    sessionId: r.session_id,
    fileName: r.file_name,
    pageNumber: r.page_number,
    code: r.code,
    title: r.title,
    kind: r.kind,
    status: r.status,
    scaleMmPerPt: r.scale_mm_per_pt,
    scaleConfidence: r.scale_confidence,
    dimUnit: r.dim_unit,
    error: r.error,
  };
}

function toBill(r: PreconBillRow): PreconBill {
  return { id: r.id, title: r.title, sort: r.sort };
}

function toRow(r: PreconBoqRowRow): PreconBoqRowDto {
  return {
    id: r.id,
    billId: r.bill_id,
    sort: r.sort,
    rowType: r.row_type,
    elementGroup: r.element_group,
    code: r.code,
    description: r.description,
    unit: r.unit,
    qtyGross: num(r.qty_gross),
    deductions: r.deductions ?? [],
    qty: num(r.qty),
    rate: num(r.rate),
    amount: num(r.amount),
    rateSource: r.rate_source,
    confidence: r.confidence,
    status: r.status,
    version: r.version,
    measurementBasis: r.measurement_basis,
    verifiedBy: r.verified_by,
    verifiedAt: r.verified_at ? new Date(r.verified_at).toISOString() : null,
  };
}

function toGeometry(r: PreconGeometryRow): PreconGeometry {
  return {
    id: r.id,
    rowId: r.row_id,
    sheetId: r.sheet_id,
    kind: r.kind,
    vertices: r.vertices ?? [],
    source: r.source,
    quantity: num(r.quantity),
    unit: r.unit,
  };
}

export function computeSummary(rows: PreconBoqRowDto[], settings: PreconSummarySettings): PreconSummary {
  const measuredTotal = rows
    .filter((r) => (r.rowType === "item" || r.rowType === "provisional_sum") && r.status !== "rejected")
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const prelims = measuredTotal * (settings.prelimsPct / 100);
  const constructionSum = measuredTotal + prelims;
  const contingency = constructionSum * (settings.contingencyPct / 100);
  const subTotal = constructionSum + contingency;
  const vat = subTotal * (settings.vatPct / 100);
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    measuredTotal: round(measuredTotal),
    prelims: round(prelims),
    constructionSum: round(constructionSum),
    contingency: round(contingency),
    subTotal: round(subTotal),
    vat: round(vat),
    grandTotal: round(subTotal + vat),
  };
}

// Geometry math: vertices are sheet coordinates (pt); scale converts to metres.
export function quantityFromVertices(
  kind: "area" | "linear" | "count" | "deduction",
  vertices: number[][],
  mmPerPt: number,
): { quantity: number; unit: string } {
  const toM = mmPerPt / 1000;
  if (kind === "count") return { quantity: vertices.length, unit: "nr" };
  if (kind === "linear") {
    let len = 0;
    for (let i = 1; i < vertices.length; i++) {
      len += Math.hypot(vertices[i]![0]! - vertices[i - 1]![0]!, vertices[i]![1]! - vertices[i - 1]![1]!);
    }
    return { quantity: Math.round(len * toM * 100) / 100, unit: "m" };
  }
  // area & deduction: shoelace over the closed polygon
  let doubled = 0;
  for (let i = 0; i < vertices.length; i++) {
    const [x1, y1] = vertices[i]!;
    const [x2, y2] = vertices[(i + 1) % vertices.length]!;
    doubled += x1! * y2! - x2! * y1!;
  }
  const area = Math.abs(doubled / 2) * toM * toM;
  return { quantity: Math.round(area * 100) / 100, unit: "m2" };
}

export interface RowChangeEvent {
  type: "row.updated" | "row.verified" | "row.rejected" | "geometry.updated";
  sessionId: string;
  rowId: string;
  version: number;
  actor: string;
  changes: Record<string, unknown>;
}

export type PublishFn = (sessionId: string, event: RowChangeEvent) => void;

export function preconService(repo: PreconRepository, publish: PublishFn = () => {}) {
  async function audit(
    sessionId: string,
    rowId: string | null,
    actor: string,
    action: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ): Promise<void> {
    await repo.insertAuditEvent({
      id: generateId("pae"),
      session_id: sessionId,
      row_id: rowId,
      actor,
      action,
      before,
      after,
    } as Omit<PreconAuditEventRow, "created_at">);
  }

  function toRateCard(r: PreconRateCardRow) {
    return { id: r.id, name: r.name, region: r.region, currency: r.currency };
  }

  function toRate(r: PreconRateRow) {
    return {
      id: r.id,
      rateCardId: r.rate_card_id,
      codePrefix: r.code_prefix,
      descriptionPattern: r.description_pattern,
      unit: r.unit,
      rate: Number(r.rate),
    };
  }

  async function requireRow(rowId: string): Promise<{ row: PreconBoqRowRow; sessionId: string }> {
    const [row, sessionId] = await Promise.all([repo.rowById(rowId), repo.sessionIdForRow(rowId)]);
    if (!row || !sessionId) throw new NotFoundError("BOQ row");
    return { row, sessionId };
  }

  return {
    async createSession(
      orgId: string,
      title: string,
      userId: string,
      files: { fileName: string; storagePath: string }[],
      proposalId: string | null = null,
    ) {
      const session = await repo.insertSession({
        id: generateId("pcs"),
        org_id: orgId,
        project_id: null,
        proposal_id: proposalId,
        status: "uploading",
        title,
        error: null,
        created_by: userId,
      });
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
          error: null,
        })),
      );
      await repo.upsertSettings({ session_id: session.id, prelims_pct: 5, contingency_pct: 5, vat_pct: 7.5 });
      await audit(session.id, null, userId, "session_created", null, { title });
      return toSession(session);
    },

    async listSessions(orgId: string, proposalId?: string) {
      return (await repo.sessionsByOrg(orgId, proposalId)).map(toSession);
    },

    async linkToProposal(sessionId: string, proposalId: string) {
      await repo.linkSessionToProposal(sessionId, proposalId);
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
      const rows = rowRows.map(toRow);
      const total = statusCounts.reduce((s, c) => s + c.count, 0);
      const verified = statusCounts.find((c) => c.status === "verified")?.count ?? 0;
      return {
        session: toSession(session),
        sheets: sheets.map(toSheet),
        bills: bills.map(toBill),
        rows,
        geometries: geometries.map(toGeometry),
        settings,
        summary: computeSummary(rows, settings),
        progress: { total, verified },
      };
    },

    async updateRow(rowId: string, body: UpdateRowBody, actor: string): Promise<PreconBoqRowDto> {
      const { row, sessionId } = await requireRow(rowId);
      if (row.row_type !== "item" && row.row_type !== "provisional_sum" && body.changes.qty !== undefined) {
        throw new BadRequestError("Only priced rows carry quantities");
      }
      const patch: Parameters<PreconRepository["updateRowVersioned"]>[2] = {};
      if (body.changes.description !== undefined) patch.description = body.changes.description;
      if (body.changes.unit !== undefined) patch.unit = body.changes.unit;
      if (body.changes.qty !== undefined) patch.qty = body.changes.qty;
      if (body.changes.rate !== undefined) {
        patch.rate = body.changes.rate;
        patch.rate_source = "manual";
      }
      const qty = body.changes.qty ?? num(row.qty);
      const rate = body.changes.rate ?? num(row.rate);
      if (qty !== null && rate !== null) patch.amount = Math.round(qty * rate * 100) / 100;
      // an edited AI row needs re-verification
      if (row.status === "verified") {
        patch.status = "needs_review";
        patch.verified_by = null;
        patch.verified_at = null;
      }
      const updated = await repo.updateRowVersioned(rowId, body.version, patch);
      if (!updated) {
        const current = await repo.rowById(rowId);
        throw new ConflictError(
          `Row was updated by someone else (current version ${current?.version ?? "?"}); refresh and reapply`,
        );
      }
      await audit(sessionId, rowId, actor, "adjusted", { qty: num(row.qty), rate: num(row.rate) }, body.changes);
      publish(sessionId, {
        type: "row.updated",
        sessionId,
        rowId,
        version: updated.version,
        actor,
        changes: body.changes,
      });
      return toRow(updated);
    },

    async verifyRow(rowId: string, version: number, actor: string): Promise<PreconBoqRowDto> {
      const { row, sessionId } = await requireRow(rowId);
      if (row.status === "verified") return toRow(row);
      if (row.status === null) throw new BadRequestError("Row is not a reviewable item");
      const updated = await repo.updateRowVersioned(rowId, version, {
        status: "verified",
        verified_by: actor,
        verified_at: new Date(),
      });
      if (!updated) throw new ConflictError("Row changed since you loaded it; refresh and re-verify");
      await audit(sessionId, rowId, actor, "verified", { status: row.status }, { status: "verified" });
      publish(sessionId, {
        type: "row.verified",
        sessionId,
        rowId,
        version: updated.version,
        actor,
        changes: { status: "verified" },
      });
      return toRow(updated);
    },

    async rejectRow(rowId: string, version: number, actor: string): Promise<PreconBoqRowDto> {
      const { row, sessionId } = await requireRow(rowId);
      if (row.status === null) throw new BadRequestError("Row is not a reviewable item");
      const updated = await repo.updateRowVersioned(rowId, version, {
        status: "rejected",
        verified_by: actor,
        verified_at: new Date(),
      });
      if (!updated) throw new ConflictError("Row changed since you loaded it; refresh and retry");
      await audit(sessionId, rowId, actor, "rejected", { status: row.status }, { status: "rejected" });
      publish(sessionId, {
        type: "row.rejected",
        sessionId,
        rowId,
        version: updated.version,
        actor,
        changes: { status: "rejected" },
      });
      return toRow(updated);
    },

    // Server-side quantity recompute: the client sends vertices, never quantities.
    async updateGeometry(rowId: string, body: UpdateGeometryBody, actor: string): Promise<PreconBoqRowDto> {
      const { row, sessionId } = await requireRow(rowId);
      const geometries = await repo.geometriesByRow(rowId);
      const sheetId = geometries[0]?.sheet_id;
      if (!sheetId) throw new BadRequestError("Row has no measurable sheet geometry");
      const sheet = await repo.sheetById(sheetId);
      if (!sheet?.scale_mm_per_pt) throw new BadRequestError("Sheet has no calibrated scale");
      const { quantity, unit } = quantityFromVertices(body.kind, body.vertices, sheet.scale_mm_per_pt);
      const deductionTotal = (row.deductions ?? []).reduce((s, d) => s + d.qty, 0);
      const net = Math.max(0, Math.round((quantity - deductionTotal) * 100) / 100);
      const updated = await repo.updateRowVersioned(rowId, body.version, {
        qty_gross: quantity,
        qty: net,
        unit,
        status: "needs_review",
        measurement_basis: `Manually re-measured (${body.kind}); gross ${quantity} ${unit}`,
        verified_by: null,
        verified_at: null,
        amount: row.rate !== null ? Math.round(net * Number(row.rate) * 100) / 100 : null,
      });
      if (!updated) throw new ConflictError("Row changed since you loaded it; refresh and redraw");
      await repo.replaceRowGeometry(rowId, {
        id: generateId("pgeo"),
        row_id: rowId,
        sheet_id: sheetId,
        kind: body.kind,
        vertices: body.vertices,
        source: "manual",
        quantity,
        unit,
      });
      await audit(sessionId, rowId, actor, "measured", { qty: num(row.qty) }, { qty: net, gross: quantity });
      publish(sessionId, {
        type: "geometry.updated",
        sessionId,
        rowId,
        version: updated.version,
        actor,
        changes: { qty: net, qtyGross: quantity },
      });
      return toRow(updated);
    },

    async addDeduction(rowId: string, body: AddDeductionBody, actor: string): Promise<PreconBoqRowDto> {
      const { row, sessionId } = await requireRow(rowId);
      const geometries = await repo.geometriesByRow(rowId);
      const sheetId = geometries[0]?.sheet_id;
      if (!sheetId) throw new BadRequestError("Row has no measurable sheet geometry");
      const sheet = await repo.sheetById(sheetId);
      if (!sheet?.scale_mm_per_pt) throw new BadRequestError("Sheet has no calibrated scale");
      const { quantity } = quantityFromVertices("deduction", body.vertices, sheet.scale_mm_per_pt);
      const geometryId = generateId("pgeo");
      const deductions: Deduction[] = [...(row.deductions ?? []), { label: body.label, qty: quantity, geometryId }];
      const gross = num(row.qty_gross) ?? num(row.qty) ?? 0;
      const net = Math.max(0, Math.round((gross - deductions.reduce((s, d) => s + d.qty, 0)) * 100) / 100);
      const updated = await repo.updateRowVersioned(rowId, body.version, {
        deductions,
        qty: net,
        status: "needs_review",
        verified_by: null,
        verified_at: null,
        amount: row.rate !== null ? Math.round(net * Number(row.rate) * 100) / 100 : null,
      });
      if (!updated) throw new ConflictError("Row changed since you loaded it; refresh and retry");
      await repo.insertGeometries([
        {
          id: geometryId,
          row_id: rowId,
          sheet_id: sheetId,
          kind: "deduction",
          vertices: body.vertices,
          source: "manual",
          quantity,
          unit: "m2",
        },
      ]);
      await audit(sessionId, rowId, actor, "deduction_added", { qty: num(row.qty) }, { label: body.label, qty: quantity });
      publish(sessionId, {
        type: "geometry.updated",
        sessionId,
        rowId,
        version: updated.version,
        actor,
        changes: { qty: net, deductions },
      });
      return toRow(updated);
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

    async listRateCards(orgId: string) {
      const cards = await repo.rateCardsByOrg(orgId);
      const allRates = await Promise.all(cards.map((c) => repo.ratesByCard(c.id)));
      return cards.map((c, i) => ({ ...toRateCard(c), rates: allRates[i]!.map(toRate) }));
    },

    async createRateCard(orgId: string, name: string, region: string | null) {
      const card = await repo.insertRateCard({
        id: generateId("prc"),
        org_id: orgId,
        name,
        region,
        currency: "NGN",
      });
      return { ...toRateCard(card), rates: [] };
    },

    async addRate(
      orgId: string,
      rateCardId: string,
      input: { codePrefix: string | null; descriptionPattern: string | null; unit: string; rate: number },
    ) {
      const card = await repo.rateCardById(rateCardId);
      if (!card || card.org_id !== orgId) throw new NotFoundError("Rate card");
      const rate = await repo.insertRate({
        id: generateId("prt"),
        rate_card_id: rateCardId,
        code_prefix: input.codePrefix,
        description_pattern: input.descriptionPattern,
        unit: input.unit,
        rate: input.rate,
      });
      return toRate(rate);
    },

    async removeRate(orgId: string, rateCardId: string, rateId: string) {
      const card = await repo.rateCardById(rateCardId);
      if (!card || card.org_id !== orgId) throw new NotFoundError("Rate card");
      await repo.deleteRate(rateId, rateCardId);
      return { ok: true };
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
