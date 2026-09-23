// What one workbook save records about itself.
//
// The entry stores the USER's document either side of the save, never the
// rendered one. Generated cells are a rendering of the bill lines and can be
// rebuilt from them at any time; keeping a copy in the trail would double the
// payload and — worse — would make an undo able to put a MEASURED quantity
// back, which is precisely what an undo must never do. Contract 7 restores the
// user's work and leaves current measurement truth alone.
//
// Alongside it goes the trusted layout (so the slots a formula points at are
// recoverable) and the before/after of every bill line the save moved, which is
// what lets a reversal put a rate back through the ordinary row policy rather
// than by writing the column directly.

import { assertAuditPayloadWithinCap } from "../editor-limits.ts";
import { num } from "../dto.ts";
import type { WorkbookCell, WorkbookCellMatrix, WorkbookSheet, WorkbookSnapshot } from "./engine-types.ts";
import type {
  PreconWorkbookRow,
  WorkbookAuditAfter,
  WorkbookAuditBefore,
  WorkbookLayout,
  WorkbookReceipt,
  WorkbookRowDelta,
  WorkbookStateV1,
} from "./types.ts";
import type { PreconBoqRowRow } from "../types.ts";

/**
 * The document with every server-generated cell removed: scratch worksheets
 * whole, and on a generated worksheet only what sits at or right of the free
 * column. This is the part a person actually typed.
 */
export function userProjection(snapshot: WorkbookSnapshot, layout: WorkbookLayout): WorkbookSnapshot {
  const freeColumnById = new Map(layout.sheets.map((sheet) => [sheet.sheetId, sheet.freeColumnStart]));
  const sheets: Record<string, WorkbookSheet> = {};

  for (const sheetId of snapshot.sheetOrder) {
    const sheet = snapshot.sheets[sheetId];
    if (!sheet) continue;
    const freeColumnStart = freeColumnById.get(sheetId) ?? 0;
    const cellData: Record<string, Record<string, WorkbookCell>> = {};
    for (const [rowKey, line] of Object.entries(sheet.cellData)) {
      const kept: Record<string, WorkbookCell> = {};
      for (const [columnKey, cell] of Object.entries(line)) {
        if (Number(columnKey) >= freeColumnStart) kept[columnKey] = cell;
      }
      if (Object.keys(kept).length > 0) cellData[rowKey] = kept;
    }
    sheets[sheetId] = { ...sheet, cellData: cellData as WorkbookCellMatrix };
  }

  return { ...snapshot, sheets };
}

export function rowDelta(row: PreconBoqRowRow): WorkbookRowDelta {
  return {
    rowId: row.id,
    version: row.version,
    description: row.description,
    rate: num(row.rate),
    amount: num(row.amount),
    status: row.status,
  };
}

export function rowDeltas(rows: readonly PreconBoqRowRow[]): Record<string, WorkbookRowDelta> {
  return Object.fromEntries(rows.map((row) => [row.id, rowDelta(row)]));
}

/**
 * Where the workbook stood before this save. A take-off that has never had one
 * records `null` for the document, which is what lets undoing the very first
 * save put the empty baseline back instead of leaving a version 1 nobody wrote.
 */
export function stateBefore(
  stored: PreconWorkbookRow | undefined,
  rows: readonly PreconBoqRowRow[],
): WorkbookStateV1 {
  return {
    version: stored?.version ?? 0,
    snapshot: stored ? userProjection(stored.snapshot, stored.layout) : null,
    layout: stored?.layout ?? null,
    sourceFingerprint: stored?.source_fingerprint ?? null,
    rows: rowDeltas(rows),
  };
}

export function stateAfter(
  version: number,
  snapshot: WorkbookSnapshot,
  layout: WorkbookLayout,
  sourceFingerprint: string,
  rows: readonly PreconBoqRowRow[],
): WorkbookStateV1 {
  return {
    version,
    snapshot: userProjection(snapshot, layout),
    layout,
    sourceFingerprint,
    rows: rowDeltas(rows),
  };
}

export interface WorkbookAuditPayload {
  readonly before: WorkbookAuditBefore;
  readonly after: WorkbookAuditAfter;
}

/**
 * The pair, checked against the existing 8 MiB audit bound before anything is
 * written. Over it, the save is refused and no version moves — the same rule
 * every other take-off operation already follows.
 */
export function auditPayload(
  before: WorkbookStateV1,
  after: WorkbookStateV1,
  requestFingerprint: string,
  receipt: WorkbookReceipt,
): WorkbookAuditPayload {
  const payload: WorkbookAuditPayload = {
    before: { schemaVersion: 1, state: before },
    after: { schemaVersion: 1, state: after, requestFingerprint, receipt },
  };
  assertAuditPayloadWithinCap(
    payload.before as unknown as Record<string, unknown>,
    payload.after as unknown as Record<string, unknown>,
  );
  return payload;
}

/**
 * The receipt exactly as it was recorded. Nothing is recomputed and nothing is
 * overlaid, so a retry is answered with the original call's figures however far
 * the workbook has moved on since.
 */
export function receiptOf(event: { id: string; after: Record<string, unknown> | null }): WorkbookReceipt | null {
  const recorded = (event.after as WorkbookAuditAfter | null)?.receipt;
  return recorded ? { ...recorded, eventId: event.id } : null;
}

export function recordedBefore(event: { before: Record<string, unknown> | null }): WorkbookStateV1 | null {
  const before = event.before as WorkbookAuditBefore | null;
  return before?.schemaVersion === 1 ? before.state : null;
}

export function recordedAfter(event: { after: Record<string, unknown> | null }): WorkbookStateV1 | null {
  const after = event.after as WorkbookAuditAfter | null;
  return after?.schemaVersion === 1 ? after.state : null;
}

export function recordedFingerprint(event: { after: Record<string, unknown> | null }): string | null {
  return (event.after as WorkbookAuditAfter | null)?.requestFingerprint ?? null;
}
