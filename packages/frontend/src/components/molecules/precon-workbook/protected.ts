// Which cells the server owns, and what a person is allowed to have done to
// them.
//
// The server refuses a whole save if ONE generated cell disagrees with what it
// would render right now (`workbook/sanitize.ts`). So this module is the
// browser's half of that same comparison, and it exists to make two things
// impossible:
//
//   1. Sending a candidate that will be refused. Protected cells are rebuilt
//      from the server's own document rather than echoed out of the grid, so
//      they go back byte-identical by construction — not by hoping Univer
//      round-tripped `{v: 24, t: 2}` without adding a cached figure.
//
//   2. Losing an edit silently. A divergence that ISN'T an allowed rate or
//      description change is reported, never stripped. Stripping would tell the
//      user their save succeeded while half of it was discarded, which is worse
//      than refusing.
//
// The two moves a person may make inside the generated block are rate and
// description, and neither travels in the grid: they become `rowPatches`, which
// the server puts through the same row policy the bill panel uses.

import type {
  WorkbookBinding,
  WorkbookCell,
  WorkbookField,
  WorkbookRowPatch,
  WorkbookSheetLayout,
} from "@/api/workbook-types";

/** Exactly the backend's `sameMeaning`. `s` is absent on purpose: formatting is the user's. */
export function sameMeaning(a: WorkbookCell | undefined, b: WorkbookCell | undefined): boolean {
  const left = a ?? {};
  const right = b ?? {};
  return (
    (left.v ?? null) === (right.v ?? null) &&
    (left.f ?? null) === (right.f ?? null) &&
    (left.t ?? null) === (right.t ?? null)
  );
}

/** Rows of a generated sheet whose protected columns the server owns. */
export function ownedRows(sheet: WorkbookSheetLayout): Set<number> {
  const rows = new Set<number>();
  for (let row = 0; row < sheet.firstBodyRow; row += 1) rows.add(row);
  for (const binding of sheet.bindings) rows.add(binding.gridRow);
  for (const slot of sheet.billSlots ?? []) rows.add(slot.gridRow);
  return rows;
}

export function columnOf(sheet: WorkbookSheetLayout, field: WorkbookField): number | null {
  const entry = Object.entries(sheet.columns).find(([, name]) => name === field);
  return entry === undefined ? null : Number(entry[0]);
}

export function bindingsByGridRow(sheet: WorkbookSheetLayout): Map<number, WorkbookBinding> {
  return new Map(sheet.bindings.map((binding) => [binding.gridRow, binding]));
}

/** True when this cell belongs to the server on this worksheet. */
export function isProtected(sheet: WorkbookSheetLayout, column: number): boolean {
  return sheet.kind !== "scratch" && column < sheet.freeColumnStart;
}

/**
 * Deliberately NOT `!isProtected`: rate and description sit inside the
 * generated block yet stay editable, because they leave as row patches rather
 * than as cells. Refusing the rest at the keystroke beats rejecting the save.
 */
export function isEditableCell(sheet: WorkbookSheetLayout, row: number, column: number): boolean {
  if (!isProtected(sheet, column)) return true;
  const field = sheet.columns[String(column)];
  if (field !== "rate" && field !== "description") return false;
  const binding = sheet.bindings.find((entry) => entry.gridRow === row);
  return binding !== undefined && binding.state === "bound";
}

// ------------------------------------------------------- allowed divergences

/** An edit inside the generated block that the server will refuse. */
export interface BlockedEdit {
  readonly sheetId: string;
  /** The worksheet's current title, for a message a person can act on. */
  readonly sheetLabel: string;
  readonly row: number;
  readonly column: number;
  readonly field: WorkbookField | null;
  readonly reason: string;
}

/** A rate or description change lifted out of the grid and into a row patch. */
export interface DerivedPatch {
  readonly rowId: string;
  readonly version: number;
  readonly field: "rate" | "description";
  readonly value: string | number;
}

const MAX_DESCRIPTION = 500;
const MAX_RATE = 1_000_000_000;

/** `Math.round(qty * rate * 100) / 100`, exactly as `row-patch.ts` computes it. */
export function canonicalAmount(qty: number | null, rate: number | null): number | null {
  if (qty === null || rate === null) return null;
  return Math.round(qty * rate * 100) / 100;
}

export function numberIn(cell: WorkbookCell | undefined): number | null {
  const value = cell?.v;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface FieldChange {
  readonly patch?: DerivedPatch;
  readonly reason?: string;
}

function readDescription(binding: WorkbookBinding, cell: WorkbookCell | undefined): FieldChange {
  if (cell?.f !== undefined) return { reason: "a description is text, not a formula" };
  const value = cell?.v;
  if (typeof value !== "string" || value.trim() === "") {
    return { reason: "a bill line must keep a description" };
  }
  if (value.length > MAX_DESCRIPTION) {
    return { reason: `a description cannot be longer than ${MAX_DESCRIPTION} characters` };
  }
  return { patch: { rowId: binding.rowId, version: binding.rowVersion, field: "description", value } };
}

function readRate(binding: WorkbookBinding, cell: WorkbookCell | undefined): FieldChange {
  if (cell?.f !== undefined) {
    return { reason: "a rate is a figure the bill line stores, so it cannot be a formula" };
  }
  const value = cell?.v;
  if (value === undefined || value === null || value === "") {
    return { reason: "clearing a rate is not supported here — type 0 to price the line at nothing" };
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_RATE) {
    return { reason: "a rate must be a number of 0 or more" };
  }
  return { patch: { rowId: binding.rowId, version: binding.rowVersion, field: "rate", value } };
}

/**
 * What one protected cell's divergence means: an allowed patch, or a refusal
 * with the reason a person needs.
 *
 * A withdrawn line is refused outright whatever the field. Its figure is a
 * `#REF!` standing in for a bill line that is no longer on the bill, and
 * pricing something that has gone is not an edit worth letting through.
 */
export function classifyProtectedChange(
  sheet: WorkbookSheetLayout,
  binding: WorkbookBinding | undefined,
  column: number,
  cell: WorkbookCell | undefined,
): FieldChange {
  const field = sheet.columns[String(column)];
  if (binding === undefined) {
    return { reason: `that cell is reserved for a bill line that has not been measured yet` };
  }
  if (binding.state === "withdrawn") {
    return { reason: "that bill line has been withdrawn from the take-off" };
  }
  if (field === "description") return readDescription(binding, cell);
  if (field === "rate") return readRate(binding, cell);
  if (field === "qty" || field === "unit") {
    return { reason: "quantities and units come from the drawings — use Remeasure to change one" };
  }
  if (field === "amount") {
    return { reason: "the amount is the quantity times the rate; change the rate instead" };
  }
  return { reason: "that cell is generated from the bill" };
}

/**
 * The generated cells for one binding row, as the server will render them once
 * the derived patches are applied.
 *
 * `amount` is recomputed for ANY patch on the row, not only a rate change:
 * `buildRowUpdatePatch` rewrites it whenever it holds a quantity and a rate,
 * whichever field the caller actually moved. So a description-only patch on a
 * line whose stored amount has drifted from `qty * rate` still lands on the
 * recomputed figure, and echoing the drifted one back is a 422.
 *
 * A row with no patches is left exactly as it was — the server does not touch
 * an unpatched row either.
 */
export function projectPatchedRow(
  sheet: WorkbookSheetLayout,
  baseline: Readonly<Record<string, WorkbookCell>> | undefined,
  patches: readonly DerivedPatch[],
): Record<string, WorkbookCell> {
  const projected: Record<string, WorkbookCell> = { ...(baseline ?? {}) };
  if (patches.length === 0) return projected;

  const rateColumn = columnOf(sheet, "rate");
  const qtyColumn = columnOf(sheet, "qty");
  const amountColumn = columnOf(sheet, "amount");

  for (const patch of patches) {
    const column = columnOf(sheet, patch.field);
    if (column === null) continue;
    projected[String(column)] =
      patch.field === "rate" ? { v: patch.value as number, t: 2 } : { v: patch.value as string, t: 1 };
  }

  if (rateColumn === null || qtyColumn === null || amountColumn === null) return projected;

  const amount = canonicalAmount(numberIn(projected[String(qtyColumn)]), numberIn(projected[String(rateColumn)]));
  // A line with no quantity keeps whatever amount it had: `buildRowUpdatePatch`
  // only writes an amount when it has both figures to multiply.
  if (amount !== null) projected[String(amountColumn)] = { v: amount, t: 2 };
  return projected;
}

export function toRowPatches(patches: readonly DerivedPatch[]): WorkbookRowPatch[] {
  const byRow = new Map<string, { rowId: string; version: number; description?: string; rate?: number }>();
  for (const patch of patches) {
    const existing = byRow.get(patch.rowId) ?? { rowId: patch.rowId, version: patch.version };
    if (patch.field === "rate") existing.rate = patch.value as number;
    else existing.description = patch.value as string;
    byRow.set(patch.rowId, existing);
  }
  return [...byRow.values()];
}
