// Naming the instances a typical row stands for, and taking one of them out.
//
// "12 typical" is not a multiplier — it is twelve real bays. The bare number was
// the whole record of that, so nothing on the line could say WHICH twelve, and
// when bay 7 turned out to have a different opening there was nowhere to put it:
// the QS could edit the shape (restating all twelve) or drop typical to 1 and
// redraw eleven times. Neither is what happened on site.
//
// So the instances get names, and N counts the measured one — twelve labels is
// twelve bays, not the original plus twelve. Taking one out is then a stated,
// reversible act: the exception becomes its own line carrying a copy of the
// measurement it was one of, and the set it left falls by exactly one.

import { BadRequestError, ConflictError } from "../../../lib/errors.ts";
import { num, toRow } from "./dto.ts";
import { duplicateRowIn } from "./editor-batch-copy.ts";
import { amountFor, recomputeRow } from "./editor-row-recompute.ts";
import type { OperationWriteContext } from "./editor-unit-of-work.ts";
import { record, requireRow } from "./editor-writers.ts";
import { basisFor } from "./measurement-basis.ts";
import { netQuantity } from "./measurements.ts";
import { measuredStateOf, reviewPatchFor } from "./review-policy.ts";
import type { MeasurementSettingsV1 } from "./editor-types.ts";
import type { PreconBoqRowDto, PreconBoqRowRow } from "./types.ts";

const STALE = "Row changed since you loaded it; refresh and retry";

const MUST_NAME =
  "This line does not record which instances it stands for. Name them before taking one out, " +
  "so the line that is left says which are still typical.";

export interface SetRepeatLabelsBody {
  version: number;
  repeatLabels: string[];
  operationId?: string;
}

export interface SplitRepeatExceptionBody {
  version: number;
  label: string;
  confirmed?: boolean;
  operationId?: string;
}

export interface SplitRepeatExceptionResult {
  row: PreconBoqRowDto;
  exception: PreconBoqRowDto;
  exceptionRowId: string;
  createdGeometryIds: string[];
}

function settingsOf(row: PreconBoqRowRow): MeasurementSettingsV1 | null {
  const stored = row.measurement_settings;
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return null;
  return stored as MeasurementSettingsV1;
}

/** The names this line records, or null when it has never recorded any. */
export function repeatLabelsOf(row: PreconBoqRowRow): string[] | null {
  const labels = settingsOf(row)?.repeatLabels;
  return Array.isArray(labels) && labels.length > 0 ? labels : null;
}

/**
 * Every name has to be usable as the identity of one instance: blank is not a
 * name, and two bays called the same thing cannot be told apart when one of them
 * is later taken out.
 */
function normaliseLabels(input: string[]): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestError("Name at least one instance, or set the number of typical instances instead");
  }
  const labels = input.map((label) => (typeof label === "string" ? label.trim() : ""));
  if (labels.some((label) => label.length === 0)) {
    throw new BadRequestError("Every instance needs a name; blank entries cannot be told apart");
  }
  if (new Set(labels).size !== labels.length) {
    throw new BadRequestError("Two instances cannot share a name; a repeated name cannot be split out later");
  }
  return labels;
}

export function repeatSettingsWith(row: PreconBoqRowRow, labels: string[] | null): MeasurementSettingsV1 {
  const base = settingsOf(row) ?? { schemaVersion: 1 as const, quantityMode: "measured" as const };
  const next: MeasurementSettingsV1 = { ...base, schemaVersion: 1, quantityMode: base.quantityMode ?? "measured" };
  if (labels === null) delete next.repeatLabels;
  else next.repeatLabels = labels;
  return next;
}

/**
 * The gross the instances each stand for. Re-added from the shapes where they
 * record enough to be re-measured, so a multi-shape bay counts all of itself;
 * falls back to the stored figure for a legacy line, which must still be
 * nameable.
 */
async function grossOf(ctx: OperationWriteContext, row: PreconBoqRowRow, sessionId: string): Promise<number> {
  try {
    return (await recomputeRow(ctx, row, sessionId)).gross;
  } catch {
    return num(row.qty_gross) ?? num(row.qty) ?? 0;
  }
}

async function rebill(
  ctx: OperationWriteContext,
  row: PreconBoqRowRow,
  version: number,
  typical: number,
  labels: string[] | null,
  gross: number,
): Promise<PreconBoqRowRow> {
  const net = netQuantity(gross, row.deductions ?? [], typical);
  const before = measuredStateOf(row);
  const updated = await ctx.rows.updateRowVersioned(row.id, version, {
    typical,
    qty: net,
    measurement_basis: basisFor({
      basis: row.measurement_basis,
      gross,
      deductions: row.deductions ?? [],
      typical,
      net,
      unit: row.unit,
    }),
    measurement_settings: repeatSettingsWith(row, labels),
    amount: amountFor(row, net),
    ...reviewPatchFor(row, before, { ...before, qty: net, typical }),
  });
  if (!updated) throw new ConflictError(STALE);
  return updated;
}

export async function setRepeatLabelsIn(
  ctx: OperationWriteContext,
  sessionId: string,
  rowId: string,
  body: SetRepeatLabelsBody,
  actor: string,
): Promise<PreconBoqRowDto> {
  const row = await requireRow(ctx, rowId);
  const labels = normaliseLabels(body.repeatLabels);
  const was = row.typical ?? 1;
  const gross = await grossOf(ctx, row, sessionId);
  const updated = await rebill(ctx, row, body.version, labels.length, labels, gross);

  await record(
    ctx,
    sessionId,
    rowId,
    actor,
    "repeat_labels_set",
    { typical: was, repeatLabels: repeatLabelsOf(row), qty: num(row.qty) },
    { typical: labels.length, repeatLabels: labels, qty: num(updated.qty) },
    body.operationId,
  );
  ctx.emit({
    type: "row.updated",
    sessionId,
    rowId,
    version: updated.version,
    actor,
    changes: { typical: labels.length, qty: num(updated.qty) },
  });
  return toRow(updated);
}

/**
 * Keeping the names in step when the count is set directly. Dropping to two
 * keeps the first two names; four names against a count of two is a line that
 * cannot say what it stands for. Raising the count past the names is refused
 * rather than inventing names nobody chose.
 */
export function labelsForTypical(row: PreconBoqRowRow, typical: number): string[] | null | undefined {
  const labels = repeatLabelsOf(row);
  if (labels === null) return undefined;
  if (typical === labels.length) return undefined;
  if (typical > labels.length) {
    throw new BadRequestError(
      `This line names ${labels.length} instance${labels.length === 1 ? "" : "s"}; ` +
        `name the other ${typical - labels.length} before counting them.`,
    );
  }
  return labels.slice(0, typical);
}

export async function splitRepeatExceptionIn(
  ctx: OperationWriteContext,
  sessionId: string,
  rowId: string,
  body: SplitRepeatExceptionBody,
  actor: string,
): Promise<SplitRepeatExceptionResult> {
  const row = await requireRow(ctx, rowId);
  const labels = repeatLabelsOf(row);
  if (labels === null) throw new BadRequestError(MUST_NAME);

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!labels.includes(label)) {
    throw new BadRequestError(`This line does not stand for an instance called "${label}"`);
  }
  if (labels.length <= 1) {
    throw new BadRequestError(
      "This line already stands for a single instance; edit it directly rather than splitting it out",
    );
  }
  // Splitting restates a priced line and creates another, so it is never
  // implicit: the QS says which instance differs and that it should be billed
  // on its own.
  if (body.confirmed !== true) {
    throw new BadRequestError(
      `Taking "${label}" out bills it separately and reduces this line to ` +
        `${labels.length - 1} typical. Confirm to proceed.`,
    );
  }

  // The exception is one instance of what the line stood for, so it carries a
  // copy of every contribution AND every opening, each under new ids.
  const copied = await duplicateRowIn(ctx, sessionId, rowId, { version: row.version, offset: [0, 0] }, actor);
  const created = await requireRow(ctx, copied.newRowId);
  const exceptionGross = num(created.qty_gross) ?? 0;
  const exceptionNet = netQuantity(exceptionGross, created.deductions ?? [], 1);
  const renamed = await ctx.rows.updateRowVersioned(created.id, created.version, {
    description: `${row.description} — ${label}`,
    typical: 1,
    qty: exceptionNet,
    measurement_basis: basisFor({
      basis: created.measurement_basis,
      gross: exceptionGross,
      deductions: created.deductions ?? [],
      typical: 1,
      net: exceptionNet,
      unit: created.unit,
    }),
    measurement_settings: null,
    amount: amountFor(created, exceptionNet),
  });
  if (!renamed) throw new ConflictError(STALE);

  const remaining = labels.filter((entry) => entry !== label);
  const parentBefore = await requireRow(ctx, rowId);
  const gross = await grossOf(ctx, parentBefore, sessionId);
  const updated = await rebill(ctx, parentBefore, parentBefore.version, remaining.length, remaining, gross);

  await record(
    ctx,
    sessionId,
    rowId,
    actor,
    "repeat_exception_split",
    { typical: labels.length, repeatLabels: labels, qty: num(row.qty) },
    {
      typical: remaining.length,
      repeatLabels: remaining,
      qty: num(updated.qty),
      label,
      exceptionRowId: renamed.id,
    },
    body.operationId,
  );
  ctx.emit({
    type: "row.updated",
    sessionId,
    rowId,
    version: updated.version,
    actor,
    changes: { typical: remaining.length, qty: num(updated.qty) },
  });
  return {
    row: toRow(updated),
    exception: toRow(renamed),
    exceptionRowId: renamed.id,
    createdGeometryIds: copied.createdGeometryIds,
  };
}
