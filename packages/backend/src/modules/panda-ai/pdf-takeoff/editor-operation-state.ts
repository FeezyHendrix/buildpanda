// The before and after of an operation, bound whole into its audit entry.
//
// This is what makes undo real rather than a special case. An earlier version
// could only reverse a row deletion, because that was the only act whose
// "before" it had kept; every geometry edit was refused with "not yet
// implemented". Here each operation records the complete editable state of every
// row and shape it touched, on both sides of the write — so reversing ANY of
// them is the same act: put the recorded `before` back.
//
// Two rules are deliberate and load-bearing:
//
//   * A reversal restores what was MEASURED and never a verification stamp. The
//     system-maintained fields (version, timestamps, editor, verifier) are not
//     part of the state, so they cannot travel backwards: an undone edit leaves
//     the line needing review, signed off by nobody.
//   * A version moves FORWARD on a reversal, never back. Two people cannot be
//     handed the same version number for different content.

import { num } from "./dto.ts";
import { canonicalJson } from "./editor-fingerprint.ts";
import type {
  GeometryStateV1,
  MarkupStateV1,
  OperationStateV1,
  RowStateV1,
  SheetStateV1,
} from "./editor-operation-types.ts";
import type { PreconBoqRowRow, PreconGeometryRow, PreconSheetRow } from "./types.ts";

export function sheetStateOf(sheet: PreconSheetRow): SheetStateV1 {
  return {
    scaleMmPerPt: sheet.scale_mm_per_pt === null || sheet.scale_mm_per_pt === undefined ? null : Number(sheet.scale_mm_per_pt),
    calibration: sheet.calibration ?? null,
    viewports: sheet.viewports ?? null,
    overlaySettings: sheet.overlay_settings ?? null,
  };
}

export function rowStateOf(row: PreconBoqRowRow): RowStateV1 {
  return {
    description: row.description,
    unit: row.unit,
    qtyGross: num(row.qty_gross),
    qty: num(row.qty),
    deductions: row.deductions ?? [],
    typical: row.typical ?? 1,
    rate: num(row.rate),
    amount: num(row.amount),
    measurementBasis: row.measurement_basis,
    measurementSettings: row.measurement_settings ?? null,
    status: row.status,
    deleted: Boolean(row.deleted_at),
  };
}

export function geometryStateOf(geometry: PreconGeometryRow): GeometryStateV1 {
  return {
    rowId: geometry.row_id,
    sheetId: geometry.sheet_id,
    kind: geometry.kind,
    vertices: geometry.vertices,
    quantity: num(geometry.quantity),
    unit: geometry.unit,
    definition: geometry.definition ?? null,
    parentGeometryId: geometry.parent_geometry_id ?? null,
    deleted: Boolean(geometry.deleted_at),
  };
}

export const emptyState = (): OperationStateV1 => ({ rows: {}, geometries: {}, sheets: {}, markups: {} });

/** Reads the state of exactly the records named, tombstones included. */
export interface StateReader {
  rows: { rowByIdIncludeDeleted(id: string): PromiseLike<PreconBoqRowRow | undefined> };
  geometries: { geometryByIdIncludeDeleted(id: string): PromiseLike<PreconGeometryRow | undefined> };
  sheets: { sheetById(id: string): PromiseLike<PreconSheetRow | undefined> };
  markups?: {
    markupById(id: string): PromiseLike<MarkupRecord | undefined>;
    commentsForMarkupIncludeDeleted(markupId: string): PromiseLike<CommentRecord[]>;
  };
}

export interface StateScope {
  rowIds: string[];
  geometryIds: string[];
  sheetIds?: string[];
  markupIds?: string[];
}

interface MarkupRecord {
  geometry: unknown;
  color?: string | null;
  style?: unknown;
  resolved_at?: Date | string | null;
  deleted_at?: Date | string | null;
  version?: number;
}

interface CommentRecord {
  id: string;
  body: string;
  body_html?: string | null;
  deleted_at?: Date | string | null;
  version?: number;
}

const stamp = (value: Date | string | null | undefined): string | null =>
  value === null || value === undefined ? null : new Date(value).toISOString();

export function markupStateOf(markup: MarkupRecord, comments: CommentRecord[]): MarkupStateV1 {
  return {
    geometry: markup.geometry,
    color: markup.color ?? null,
    style: markup.style ?? null,
    resolvedAt: stamp(markup.resolved_at),
    deletedAt: stamp(markup.deleted_at),
    version: markup.version ?? 1,
    comments: Object.fromEntries(
      comments.map((c) => [
        c.id,
        { body: c.body, bodyHtml: c.body_html ?? null, deletedAt: stamp(c.deleted_at), version: c.version ?? 1 },
      ]),
    ),
  };
}

export async function captureState(reader: StateReader, scope: StateScope): Promise<OperationStateV1> {
  const state = emptyState();
  for (const id of new Set(scope.rowIds)) {
    const row = await reader.rows.rowByIdIncludeDeleted(id);
    state.rows[id] = row ? rowStateOf(row) : null;
  }
  for (const id of new Set(scope.geometryIds)) {
    const geometry = await reader.geometries.geometryByIdIncludeDeleted(id);
    state.geometries[id] = geometry ? geometryStateOf(geometry) : null;
  }
  for (const id of new Set(scope.sheetIds ?? [])) {
    const sheet = await reader.sheets.sheetById(id);
    state.sheets![id] = sheet ? sheetStateOf(sheet) : null;
  }
  for (const id of new Set(scope.markupIds ?? [])) {
    const markup = await reader.markups?.markupById(id);
    state.markups![id] = markup
      ? markupStateOf(markup, (await reader.markups!.commentsForMarkupIncludeDeleted(id)) ?? [])
      : null;
  }
  return state;
}

export function scopeOfState(state: OperationStateV1): StateScope {
  return {
    rowIds: Object.keys(state.rows),
    geometryIds: Object.keys(state.geometries),
    sheetIds: Object.keys(state.sheets ?? {}),
    markupIds: Object.keys(state.markups ?? {}),
  };
}

export function mergeScopes(...scopes: StateScope[]): StateScope {
  return {
    rowIds: [...new Set(scopes.flatMap((s) => s.rowIds))],
    geometryIds: [...new Set(scopes.flatMap((s) => s.geometryIds))],
    sheetIds: [...new Set(scopes.flatMap((s) => s.sheetIds ?? []))],
    markupIds: [...new Set(scopes.flatMap((s) => s.markupIds ?? []))],
  };
}

// ---------- comparison ----------

// Canonical, not plain JSON.stringify: one side of every comparison has been
// through a jsonb column, which normalises key order, while the other is built
// in JS with its declared order. Comparing raw serialisations would report a
// difference on every single field and make all reversal look conflicted.
function sameJson(a: unknown, b: unknown): boolean {
  return canonicalJson(a ?? null) === canonicalJson(b ?? null);
}

/**
 * Whether the live records still say what an operation said they said when it
 * committed. Compared field by field over the editable state only, so the
 * version bumps and timestamps every write produces do not count as somebody
 * else's change — but a moved vertex, a changed factor or a restored tombstone
 * does. A record that has since vanished entirely is a difference too.
 */
export function statesMatch(recorded: OperationStateV1, live: OperationStateV1): boolean {
  for (const [id, expected] of Object.entries(recorded.rows)) {
    if (!sameJson(expected, live.rows[id] ?? null)) return false;
  }
  for (const [id, expected] of Object.entries(recorded.geometries)) {
    if (!sameJson(expected, live.geometries[id] ?? null)) return false;
  }
  for (const [id, expected] of Object.entries(recorded.sheets ?? {})) {
    if (!sameJson(expected, live.sheets?.[id] ?? null)) return false;
  }
  return true;
}

/** The first field that differs, for an error message the QS can act on. */
export function firstDifference(recorded: OperationStateV1, live: OperationStateV1): string | null {
  for (const [id, expected] of Object.entries(recorded.rows)) {
    if (!sameJson(expected, live.rows[id] ?? null)) return `bill line ${id}`;
  }
  for (const [id, expected] of Object.entries(recorded.geometries)) {
    if (!sameJson(expected, live.geometries[id] ?? null)) return `measurement ${id}`;
  }
  for (const [id, expected] of Object.entries(recorded.sheets ?? {})) {
    if (!sameJson(expected, live.sheets?.[id] ?? null)) return `drawing ${id}`;
  }
  return null;
}
