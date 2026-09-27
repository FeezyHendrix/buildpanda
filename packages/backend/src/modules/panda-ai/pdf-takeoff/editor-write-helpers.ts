// The write helpers every editor writer shares: the audit record, the row and
// sheet lookups, the anchor test and the derived-row recompute.
//
// Split out of editor-writers.ts when that file crossed the house 400-line
// ceiling. Nothing here decides what a line is worth; the quantity maths lives
// in measurements.ts and editor-row-recompute.ts. Every function takes the
// transaction-bound context, so none of them can write outside the lock.

import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import { num } from "./dto.ts";
import { assertAuditPayloadWithinCap } from "./editor-limits.ts";
import type { EditorWriteContext } from "./editor-unit-of-work.ts";
import { DERIVED_BASIS_PATTERN, anchorsFromRows, evaluateFormula } from "./engine/enrich.ts";
import { MANUAL_BILL_TITLE } from "./manual-service.ts";
import type {
  MeasureFactor,
  MeasureTool,
  PreconBillRow,
  PreconBoqRowRow,
  PreconSheetRow,
} from "./types.ts";

export function factorClause(tool: MeasureTool, factor: MeasureFactor): string {
  if (tool === "wall_area") return ` × ${factor.heightM} m height`;
  if (tool === "volume") return ` × ${factor.depthM} m depth`;
  return "";
}

export function isAnchorRow(row: PreconBoqRowRow): boolean {
  if (row.code === "F10/125" || row.code === "M10") return true;
  return (row.code === "L11" || row.code === "L20") && /type [WD]\d/i.test(row.description);
}

export function record(
  ctx: EditorWriteContext,
  sessionId: string,
  rowId: string | null,
  actor: string,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  operationId?: string,
): PromiseLike<unknown> {
  assertAuditPayloadWithinCap(before, after);
  return ctx.audits.insertAuditEvent({
    id: generateId("pae"),
    session_id: sessionId,
    row_id: rowId,
    actor,
    action,
    before,
    after,
    operation_id: operationId ?? null,
  });
}

export async function requireRow(ctx: EditorWriteContext, rowId: string): Promise<PreconBoqRowRow> {
  const row = await ctx.rows.rowById(rowId);
  if (!row) throw new NotFoundError("BOQ row");
  return row;
}

// Falls back to the row's last-measured sheet, so a never-measured row stays
// measurable. The id is caller-supplied, so it is checked against the session:
// otherwise one session could measure another's sheet.
export async function requireSheet(
  ctx: EditorWriteContext,
  rowId: string,
  sessionId: string,
  sheetId?: string,
): Promise<PreconSheetRow> {
  const target = sheetId ?? (await ctx.geometries.geometriesByRow(rowId))[0]?.sheet_id;
  if (!target) throw new BadRequestError("Open the sheet you want to measure on first");
  const sheet = await ctx.sheets.sheetById(target);
  if (!sheet || sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
  return sheet;
}

// Derived rows carry their formula in the measurement basis; correcting a
// measured anchor has to carry the build-up with it, in the same transaction as
// the correction — a committed anchor with stale derived lines is a wrong bill.
export async function recomputeDerivedRows(ctx: EditorWriteContext, sessionId: string, actor: string): Promise<void> {
  const rows = await ctx.rows.rowsBySession(sessionId);
  const anchors = anchorsFromRows(rows);
  for (const row of rows) {
    if (row.status === "rejected") continue;
    const match = row.measurement_basis?.match(DERIVED_BASIS_PATTERN);
    if (!match) continue;
    const value = evaluateFormula(match[1]!, anchors);
    if (value === null || Math.abs(value - Number(row.qty ?? 0)) < 0.005) continue;
    const amount = row.rate !== null ? Math.round(value * Number(row.rate) * 100) / 100 : null;
    const basis = `Derived: ${match[1]} = ${value} (engine-evaluated over measured anchors)`;
    const updated = await ctx.rows.applyDerivedRecompute(row.id, value, amount, basis);
    if (!updated) continue;
    await record(ctx, sessionId, row.id, actor, "recomputed", { qty: num(row.qty) }, { qty: value });
    ctx.emit({
      type: "row.updated",
      sessionId,
      rowId: row.id,
      version: updated.version,
      actor,
      changes: { qty: value, amount },
    });
  }
}

export async function targetBill(ctx: EditorWriteContext, sessionId: string, billId?: string): Promise<PreconBillRow> {
  if (billId) {
    const bill = await ctx.bills.billById(billId);
    if (!bill || bill.session_id !== sessionId) throw new NotFoundError("Bill");
    return bill;
  }
  const [first] = await ctx.bills.billsBySession(sessionId);
  return (
    first ?? ctx.bills.insertBill({ id: generateId("pbl"), session_id: sessionId, title: MANUAL_BILL_TITLE, sort: 0 })
  );
}
