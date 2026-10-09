// Bill lines: the row as stored, the row as served, and the enums that
// describe it. Depends only on geometry-types and the measurement-settings
// record, which owns its own shape.
import type { MeasurementSettingsV1 } from "./editor-types.ts";
import type { Deduction, DeductionDto, MeasuredGeometry, PreconGeometry } from "./geometry-types.ts";

// Who wrote a row: the engine, a person, a Panda AI prompt, or the migration.
export const ROW_ORIGINS = ["ai", "manual", "prompt", "migrated"] as const;
export type RowOrigin = (typeof ROW_ORIGINS)[number];

export const ROW_TYPES = ["heading", "work_section", "spec_note", "item", "provisional_sum"] as const;
export type RowType = (typeof ROW_TYPES)[number];

export const ROW_STATUSES = ["ai_generated", "needs_review", "verified", "rejected"] as const;
export type RowStatus = (typeof ROW_STATUSES)[number];

export const CONFIDENCES = ["high", "low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export interface PreconBoqRowRow {
  id: string;
  bill_id: string;
  sort: number;
  row_type: RowType;
  element_group: string | null;
  code: string | null;
  description: string;
  unit: string | null;
  qty_gross: string | number | null;
  deductions: Deduction[];
  // × identical floors/areas: net = (qty_gross − Σdeductions) × typical. Optional
  // on the row so engine inserts take the column default of 1.
  typical?: number;
  qty: string | number | null;
  rate: string | number | null;
  amount: string | number | null;
  rate_source: string | null;
  confidence: Confidence | null;
  status: RowStatus | null;
  version: number;
  measurement_basis: string | null;
  confidence_reason: string | null;
  provenance: string | null;
  // DWG entity handles the engine computed this line from
  evidence?: number[] | null;
  origin: RowOrigin;
  edited_at: Date | null;
  edited_by: string | null;
  verified_by: string | null;
  verified_at: Date | null;
  // A line withdrawn during a dispute is still a record of what was once
  // claimed: hidden, never erased.
  deleted_at?: Date | null;
  // jsonb written by older code too, so it is parsed before anything trusts it
  measurement_settings?: unknown;
  created_at: Date;
  updated_at: Date;
}

export interface PreconBoqRowDto {
  id: string;
  billId: string;
  sort: number;
  rowType: RowType;
  elementGroup: string | null;
  code: string | null;
  description: string;
  unit: string | null;
  qtyGross: number | null;
  deductions: DeductionDto[];
  typical: number;
  qty: number | null;
  rate: number | null;
  amount: number | null;
  rateSource: string | null;
  confidence: Confidence | null;
  status: RowStatus | null;
  version: number;
  measurementBasis: string | null;
  confidenceReason: string | null;
  provenance: string | null;
  evidence?: number[];
  // The measurement that produced the figure, as it was made — jsonb from the
  // line's own geometry, so a surface that only sees the bill can still say
  // which tool and factor a quantity rests on. Absent where nothing is loaded.
  measurementDefinition?: unknown;
  // How the line is billed beyond its figure: the names it stands for, and the
  // record of a quantity that was stated rather than drawn. Null on a line that
  // has never recorded any — which is not the same as one that recorded none.
  measurementSettings: MeasurementSettingsV1 | null;
  origin: RowOrigin;
  editedAt: string | null;
  editedBy: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
}

export interface PreconAuditEventRow {
  id: string;
  session_id: string;
  row_id: string | null;
  actor: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  // A retried save carries the operation id of the first attempt, so the edit
  // is recorded once; an undo names the event it reverses.
  operation_id?: string | null;
  reverses_event_id?: string | null;
  created_at: Date;
}

export interface ReviewProgress {
  total: number;
  verified: number;
}

export const ITEM_SCOPES = ["per-floor", "whole-building"] as const;
export type ItemScope = (typeof ITEM_SCOPES)[number];

export interface MeasuredBoqItem {
  elementGroup: string;
  workSection: { code: string; title: string };
  specNote: string | null;
  groupHeading?: string | null;
  code: string | null;
  description: string;
  unit: string;
  qtyGross: number;
  deductions: { label: string; qty: number }[];
  qty: number;
  confidence: Confidence;
  measurementBasis: string;
  geometries: MeasuredGeometry[];
  pageNumber: number;
  scope?: ItemScope;
  provisional?: boolean;
  // why the engine doubted this line, in the reviewer's words ("scale", "vision", ...)
  confidenceReason?: string | null;
}

export interface CreateMeasurementResult {
  row: PreconBoqRowDto;
  geometry: PreconGeometry;
}

export interface AssemblyMeasurementResult {
  rows: PreconBoqRowDto[];
  // the first line's shape; every line carries a copy of the same vertices
  geometry: PreconGeometry;
  geometries: PreconGeometry[];
}
