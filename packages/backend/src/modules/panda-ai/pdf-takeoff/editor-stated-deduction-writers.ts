// Reaching an opening that has no shape.
//
// `editor-deduction-writers.ts` finds its target by `geometryId`. Every opening
// a PERSON adds has one. Every opening the ENGINE drafts does not —
// `boq-draft.ts` writes `{ geometryId: null, unitConfirmed: false }` — so the
// most common stated opening on a take-off was unreachable by any command: it
// could not be corrected, and it could not be taken off.
//
// Two rules make addressing one by position safe, and both are refusals rather
// than repairs:
//
//   * a position is not an identity. The row version must be the one the caller
//     was shown AND the entry in that slot must still say exactly what they were
//     shown, or the edit lands on a different void than the one they meant.
//   * an opening that HAS a shape is not reachable here. Editing it through this
//     path would restate a figure while leaving the drawing that justifies it
//     untouched — the two would then disagree, which is the one thing a bill
//     read in a dispute must never do.
//
// No geometry is created, moved or withdrawn by either command: a record that
// never had a shape does not acquire one by being corrected.

import { BadRequestError, ConflictError, NotFoundError } from "../../../lib/errors.ts";
import { num, toRow } from "./dto.ts";
import { commitDeductions, grossOf } from "./editor-deduction-writers.ts";
import type { OperationWriteContext } from "./editor-unit-of-work.ts";
import { record, requireRow } from "./editor-write-helpers.ts";
import type { Deduction, PreconBoqRowDto, PreconBoqRowRow } from "./types.ts";
import type { EditStatedDeductionCommand, StatedDeductionTarget } from "./editor-deduction-command-types.ts";

const round2 = (v: number): number => Math.round(v * 100) / 100;

interface Located {
  row: PreconBoqRowRow;
  deductions: Deduction[];
  index: number;
  entry: Deduction;
}

async function locate(ctx: OperationWriteContext, target: StatedDeductionTarget): Promise<Located> {
  const row = await requireRow(ctx, target.rowId);
  if (row.version !== target.rowVersion) {
    throw new ConflictError(
      `Line was updated by someone else (current version ${row.version}); refresh and reapply. ` +
        "An opening is named by its position on the line, so a stale version cannot be reconciled.",
    );
  }
  const deductions = row.deductions ?? [];
  const entry = deductions[target.index];
  if (!entry) {
    throw new NotFoundError(
      `Opening ${target.index + 1} of ${deductions.length} on this line`,
    );
  }
  if (entry.geometryId !== null) {
    throw new BadRequestError(
      `"${entry.label}" is drawn on the sheet, so it is corrected through its own shape, not by position. ` +
        "Use edit-deduction with its geometry id.",
    );
  }
  const matches =
    entry.label === target.expect.label &&
    round2(entry.qty) === round2(target.expect.qty) &&
    (entry.unit ?? null) === (target.expect.unit ?? null);
  if (!matches) {
    throw new ConflictError(
      `Opening ${target.index + 1} on this line is now "${entry.label}" ${entry.qty} ${entry.unit ?? ""}`.trim() +
        `, not "${target.expect.label}" ${target.expect.qty} ${target.expect.unit ?? ""}`.trimEnd() +
        ". Refresh and reapply, so the correction lands on the opening you meant.",
    );
  }
  return { row, deductions, index: target.index, entry };
}

export async function editStatedDeductionIn(
  ctx: OperationWriteContext,
  sessionId: string,
  command: EditStatedDeductionCommand,
  actor: string,
): Promise<PreconBoqRowDto> {
  const { row, deductions, index, entry } = await locate(ctx, command);
  if (command.unitConfirmed !== true) {
    throw new BadRequestError(
      `"${entry.label}" records ${entry.qty} ${entry.unit ?? "in no stated unit"}, which nobody has checked against ` +
        "the line it nets off. Confirm the unit as part of correcting it.",
    );
  }
  if (!Number.isFinite(command.qty) || command.qty <= 0) {
    throw new BadRequestError("An opening has to take a positive figure off the line");
  }

  const next = [...deductions];
  next[index] = {
    label: command.label?.trim() || entry.label,
    qty: round2(command.qty),
    geometryId: null,
    unit: command.unit,
    unitConfirmed: true,
  };
  const gross = await grossOf(ctx, row, sessionId);
  const updated = await commitDeductions({ ctx, sessionId, row, version: row.version, next, gross });

  await record(
    ctx,
    sessionId,
    row.id,
    actor,
    "stated_deduction_edited",
    { qty: num(row.qty), index, label: entry.label, deducted: entry.qty, unit: entry.unit, unitConfirmed: entry.unitConfirmed },
    { qty: num(updated.qty), index, label: next[index]!.label, deducted: next[index]!.qty, unit: command.unit, unitConfirmed: true },
    undefined,
  );
  ctx.emit({
    type: "geometry.updated",
    sessionId,
    rowId: row.id,
    version: updated.version,
    actor,
    changes: { qty: num(updated.qty), deductions: next },
  });
  return toRow(updated);
}

export async function removeStatedDeductionIn(
  ctx: OperationWriteContext,
  sessionId: string,
  command: StatedDeductionTarget,
  actor: string,
): Promise<PreconBoqRowDto> {
  const { row, deductions, index, entry } = await locate(ctx, command);
  const next = deductions.filter((_, at) => at !== index);
  const gross = await grossOf(ctx, row, sessionId);
  const updated = await commitDeductions({ ctx, sessionId, row, version: row.version, next, gross });

  await record(
    ctx,
    sessionId,
    row.id,
    actor,
    "stated_deduction_removed",
    { qty: num(row.qty), index, label: entry.label, deducted: entry.qty, unit: entry.unit },
    { qty: num(updated.qty), index },
    undefined,
  );
  ctx.emit({
    type: "geometry.updated",
    sessionId,
    rowId: row.id,
    version: updated.version,
    actor,
    changes: { qty: num(updated.qty), deductions: next },
  });
  return toRow(updated);
}
