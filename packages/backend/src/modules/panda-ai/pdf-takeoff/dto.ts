// Row → DTO mappers for the take-off, plus the two pure calculations the
// service and its siblings share. No I/O, no repository, no framework.
import { readDefinitionV1, readMeasurementSettings } from "./editor-types.ts";
import { DEDUCTION_MODES, type DeductionDto, type DeductionMode } from "./geometry-types.ts";
import type {
  PreconBill,
  PreconBillRow,
  PreconBoqRowDto,
  PreconBoqRowRow,
  PreconGeometry,
  PreconGeometryRow,
  PreconProgrammeTaskBase,
  PreconProgrammeTaskRow,
  PreconSession,
  PreconSessionRow,
  PreconSheet,
  PreconSheetRow,
  PreconSummary,
  PreconSummarySettings,
  ProgrammeDependency,
  TakeoffScope,
} from "./types.ts";
import { FULL_TAKEOFF_SCOPE } from "./types.ts";

export const num = (v: string | number | null): number | null => (v === null ? null : Number(v));

// pg serialises a plain object into jsonb; typed as the row field so the
// repository insert stays honest about what it stores.
export const db_json = (scope: TakeoffScope): TakeoffScope => ({ kind: scope.kind, elements: [...scope.elements] });

export function toSession(r: PreconSessionRow): PreconSession {
  return {
    id: r.id,
    orgId: r.org_id,
    projectId: r.project_id,
    proposalId: r.proposal_id,
    status: r.status,
    title: r.title,
    error: r.error,
    phase: r.phase ?? null,
    progressLog: r.progress_log ?? [],
    scope: r.scope ?? FULL_TAKEOFF_SCOPE,
    planId: r.plan_id ?? null,
    takeoffKind: r.takeoff_kind ?? "pdf",
    extraction: r.extraction ?? null,
    structureContext: r.structure_context ?? null,
    layerMap: r.layer_map ?? null,
    revision: r.revision ?? 1,
    supersededBy: r.superseded_by ?? null,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export function toSheet(r: PreconSheetRow): PreconSheet {
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
    geoSummary: r.geo_summary ?? null,
    bounds: r.bounds ?? null,
    viewports: r.viewports ?? [],
    version: r.version ?? 1,
    calibration: r.calibration ?? null,
    overlaySettings: r.overlay_settings ?? null,
    error: r.error,
  };
}

export function toBill(r: PreconBillRow): PreconBill {
  return { id: r.id, title: r.title, sort: r.sort };
}

export function toProgrammeTask(r: PreconProgrammeTaskRow): PreconProgrammeTaskBase {
  return {
    id: r.id,
    sessionId: r.session_id,
    sort: r.sort,
    name: r.name,
    elementGroup: r.element_group,
    wbsCode: r.wbs_code,
    outlineLevel: r.outline_level,
    parentTaskId: r.parent_task_id,
    durationDays: Number(r.duration_days),
    predecessors:
      typeof r.predecessors === "string"
        ? (JSON.parse(r.predecessors) as ProgrammeDependency[])
        : r.predecessors,
    isMilestone: r.is_milestone,
    totalFloatDays: r.total_float_days ?? null,
    isCritical: Boolean(r.is_critical),
    origin: r.origin ?? "ai",
    basis: r.basis,
    confidence: r.confidence,
    status: r.status,
    version: r.version,
    verifiedBy: r.verified_by,
    verifiedAt: r.verified_at ? new Date(r.verified_at).toISOString() : null,
  };
}

export function toRow(r: PreconBoqRowRow): PreconBoqRowDto {
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
    typical: r.typical ?? 1,
    qty: num(r.qty),
    rate: num(r.rate),
    amount: num(r.amount),
    rateSource: r.rate_source,
    confidence: r.confidence,
    status: r.status,
    version: r.version,
    measurementBasis: r.measurement_basis,
    confidenceReason: r.confidence_reason ?? null,
    provenance: r.provenance ?? null,
    evidence: r.evidence ?? [],
    measurementSettings: readMeasurementSettings(r.measurement_settings),
    origin: r.origin ?? "ai",
    editedAt: r.edited_at ? new Date(r.edited_at).toISOString() : null,
    editedBy: r.edited_by ?? null,
    verifiedBy: r.verified_by,
    verifiedAt: r.verified_at ? new Date(r.verified_at).toISOString() : null,
  };
}

export function openingFacts(definition: unknown): Pick<DeductionDto, "mode" | "dimensions"> {
  if (typeof definition !== "object" || definition === null) return {};
  const { mode, dimensions } = definition as { mode?: unknown; dimensions?: unknown };
  return {
    ...((DEDUCTION_MODES as readonly unknown[]).includes(mode) ? { mode: mode as DeductionMode } : {}),
    ...(typeof dimensions === "object" && dimensions !== null
      ? { dimensions: dimensions as DeductionDto["dimensions"] }
      : {}),
  };
}

/**
 * The bill lines carrying the measurement each was drawn with. A line can have
 * several annotations; the newest non-deduction one is what produced the
 * figure, so the geometries are read oldest-first and the last write wins.
 *
 * Openings are rejoined to their own definitions, which is where how-it-was-taken
 * is recorded — never on the row.
 */
export function toRowsWithMeasurement(rows: PreconBoqRowRow[], geometries: PreconGeometryRow[]): PreconBoqRowDto[] {
  const definitionByRow = new Map<string, unknown>();
  const openingByGeometry = new Map<string, Pick<DeductionDto, "mode" | "dimensions">>();
  for (const g of geometries) {
    if (g.kind === "deduction") openingByGeometry.set(g.id, openingFacts(g.definition));
    else if (g.definition != null) definitionByRow.set(g.row_id, g.definition);
  }
  return rows.map((r) => ({
    ...toRow(r),
    deductions: (r.deductions ?? []).map((d) =>
      d.geometryId === null ? d : { ...d, ...(openingByGeometry.get(d.geometryId) ?? {}) },
    ),
    measurementDefinition: definitionByRow.get(r.id) ?? null,
  }));
}

export function toGeometry(r: PreconGeometryRow): PreconGeometry {
  return {
    id: r.id,
    rowId: r.row_id,
    sheetId: r.sheet_id,
    kind: r.kind,
    vertices: r.vertices ?? [],
    source: r.source,
    quantity: num(r.quantity),
    unit: r.unit,
    // Per drawing, parsed field by field. The row-level `measurementDefinition`
    // is one definition chosen by last-write-wins across the line's drawings, so
    // on a line measured by several it describes one and mis-describes the rest.
    definition: readDefinitionV1(r.definition),
    parentGeometryId: r.parent_geometry_id ?? null,
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
