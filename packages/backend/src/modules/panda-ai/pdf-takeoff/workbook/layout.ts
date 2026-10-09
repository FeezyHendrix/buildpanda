// Where every bill line lives on the grid, decided by the server and by nobody
// else.
//
// The single rule this file exists to enforce: A SLOT IS ASSIGNED ONCE. It is
// never recomputed from a sorted visible index, never compacted when a line is
// withdrawn, and never reused. A withdrawn line keeps its row as a tombstone; a
// new line takes the next free row at the bottom.
//
// That is stronger than the reference-adjusting insert the plan allows as a
// fallback, and it is stronger for a reason: adjusting references means editing
// formula text a person wrote, and a rewrite that gets one case wrong turns a
// priced bill into a wrong priced bill with no error anywhere. Appending means
// no cell a user's formula points at ever moves, so there is nothing to adjust.
//
// Generated CONTENT is regenerated on every read (see `hydrate.ts`); only
// generated ADDRESSES are permanent. So a bill's total formula can widen as the
// bill grows, while `Summary!B4` still means the same bill it always did.

import {
  WORKBOOK_ENGINE_VERSION,
  type WorkbookBasis,
  type WorkbookBillSlot,
  type WorkbookBinding,
  type WorkbookField,
  type WorkbookLayout,
  type WorkbookSheetLayout,
} from "./types.ts";
import { measuringGeometriesByRow, type WorkbookSourceSet } from "./source.ts";
import type { PreconBoqRowRow } from "../types.ts";

export const SUMMARY_SHEET_ID = "wb-summary";
export const BILL_SHEET_PREFIX = "wb-bill-";

/** Label, Amount. A person writes from column 2 rightwards. */
export const SUMMARY_COLUMNS: Readonly<Record<string, WorkbookField>> = Object.freeze({
  "0": "label",
  "1": "amount",
});
export const SUMMARY_FIRST_BODY_ROW = 2;
export const SUMMARY_FREE_COLUMN_START = 2;

/**
 * Code, Description, Unit, Qty, Rate, Amount — then free calculation columns.
 *
 * Free space is to the RIGHT, never below. Below is where the next measured
 * line appends, so a free area down there would collide with generated content
 * the moment the bill grew. To the right it never can.
 */
export const BILL_COLUMNS: Readonly<Record<string, WorkbookField>> = Object.freeze({
  "0": "code",
  "1": "description",
  "2": "unit",
  "3": "qty",
  "4": "rate",
  "5": "amount",
});
export const BILL_FIRST_BODY_ROW = 1;
export const BILL_FREE_COLUMN_START = 6;

export const workbookIdFor = (sessionId: string): string => `wb-${sessionId}`;
export const billSheetIdFor = (billId: string): string => `${BILL_SHEET_PREFIX}${billId}`;
export const isGeneratedSheetId = (sheetId: string): boolean =>
  sheetId === SUMMARY_SHEET_ID || sheetId.startsWith(BILL_SHEET_PREFIX);

const PRICED_ROW_TYPES = new Set(["item", "provisional_sum"]);

/**
 * A worksheet name a cross-sheet formula can actually spell. Excel forbids
 * `[]:*?/\`, caps the name at 31 characters and refuses a leading or trailing
 * apostrophe; Univer and the ExcelJS export both inherit those limits.
 */
export function safeSheetName(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[[\]:*?/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'+|'+$/g, "")
    .slice(0, 31)
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * `candidate`, or the first ` (n)` variant of it nobody has claimed. `taken`
 * holds lower-cased names and is ADDED TO, because two callers picking names
 * for the same workbook must not both be told a name is free.
 */
export function uniqueSheetName(candidate: string, taken: Set<string>): string {
  const key = (name: string): string => name.toLowerCase();
  if (!taken.has(key(candidate))) {
    taken.add(key(candidate));
    return candidate;
  }
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const tag = ` (${suffix})`;
    const name = `${candidate.slice(0, 31 - tag.length).trim()}${tag}`;
    if (!taken.has(key(name))) {
      taken.add(key(name));
      return name;
    }
  }
  throw new Error(`cannot find a unique worksheet name for "${candidate}"`);
}

/**
 * Slots for the keys present now, honouring every slot already handed out.
 *
 * `next` starts past the highest slot ever issued — not past the highest slot
 * still in use — so a withdrawn line's row is never handed to a different line.
 */
function assignSlots(previous: ReadonlyMap<string, number>, liveKeys: readonly string[], firstRow: number): Map<string, number> {
  const slots = new Map(previous);
  let next = firstRow;
  for (const gridRow of previous.values()) next = Math.max(next, gridRow + 1);
  for (const key of liveKeys) {
    if (slots.has(key)) continue;
    slots.set(key, next);
    next += 1;
  }
  return slots;
}

export function basisOf(row: PreconBoqRowRow, measuringCount: number, hasDefinition: boolean): WorkbookBasis {
  if (!PRICED_ROW_TYPES.has(row.row_type)) return "narrative";
  if (measuringCount === 0) return "stated";
  return hasDefinition ? "measured" : "legacy";
}

function bindingsFor(
  rowsOfBill: readonly PreconBoqRowRow[],
  previous: readonly WorkbookBinding[],
  source: WorkbookSourceSet,
): WorkbookBinding[] {
  const geometriesByRow = measuringGeometriesByRow(source);
  const liveById = new Map(rowsOfBill.filter((row) => row.deleted_at == null).map((row) => [row.id, row]));
  const slots = assignSlots(
    new Map(previous.map((binding) => [binding.rowId, binding.gridRow])),
    [...liveById.keys()],
    BILL_FIRST_BODY_ROW,
  );
  const knownById = new Map(rowsOfBill.map((row) => [row.id, row]));
  const previousById = new Map(previous.map((binding) => [binding.rowId, binding]));

  const bindings: WorkbookBinding[] = [];
  for (const [rowId, gridRow] of slots) {
    const live = liveById.get(rowId);
    if (!live) {
      // Withdrawn, or gone from the table entirely. Either way the slot stays,
      // carrying the last binding we recorded so the UI can still name it.
      const recorded = previousById.get(rowId);
      const known = knownById.get(rowId);
      bindings.push({
        rowId,
        rowVersion: known?.version ?? recorded?.rowVersion ?? 0,
        gridRow,
        state: "withdrawn",
        basis: recorded?.basis ?? "narrative",
        remeasurable: false,
        geometryIds: [],
        sourceSheetIds: [],
        revision: recorded?.revision ?? source.revision,
      });
      continue;
    }
    const geometries = geometriesByRow.get(rowId) ?? [];
    const basis = basisOf(live, geometries.length, geometries.some((geometry) => geometry.definition != null));
    bindings.push({
      rowId,
      rowVersion: live.version,
      gridRow,
      state: "bound",
      basis,
      remeasurable: basis === "measured",
      geometryIds: geometries.map((geometry) => geometry.id),
      sourceSheetIds: [...new Set(geometries.map((geometry) => geometry.sheet_id))],
      revision: previousById.get(rowId)?.revision ?? source.revision,
    });
  }
  return bindings.sort((a, b) => a.gridRow - b.gridRow);
}

function billSlotsFor(source: WorkbookSourceSet, previous: readonly WorkbookBillSlot[]): WorkbookBillSlot[] {
  const liveById = new Map(source.bills.map((bill) => [bill.id, bill]));
  const slots = assignSlots(
    new Map(previous.map((slot) => [slot.billId, slot.gridRow])),
    [...liveById.keys()],
    SUMMARY_FIRST_BODY_ROW,
  );
  const previousById = new Map(previous.map((slot) => [slot.billId, slot]));
  return [...slots]
    .map(([billId, gridRow]): WorkbookBillSlot => {
      const live = liveById.get(billId);
      return {
        billId,
        gridRow,
        label: live?.title ?? previousById.get(billId)?.label ?? billId,
        state: live ? "bound" : "withdrawn",
      };
    })
    .sort((a, b) => a.gridRow - b.gridRow);
}

/**
 * The generated half of the layout: the Summary worksheet and one worksheet per
 * bill the take-off has ever had.
 *
 * A worksheet's NAME is taken from the previous layout whenever one exists, and
 * only invented for a bill being seen for the first time. Renaming a bill
 * therefore changes `label` and leaves `name` alone — because `name` is what
 * `=SUM('Bill No. 1'!F2:F9)` spells, and silently rewriting it would turn a
 * QS's working formula into a `#REF!` nobody asked for.
 */
export function buildGeneratedLayout(source: WorkbookSourceSet, previous?: WorkbookLayout): WorkbookSheetLayout[] {
  const previousById = new Map((previous?.sheets ?? []).map((sheet) => [sheet.sheetId, sheet]));
  const taken = new Set<string>();
  for (const sheet of previous?.sheets ?? []) taken.add(sheet.name.toLowerCase());

  const previousSummary = previousById.get(SUMMARY_SHEET_ID);
  const summary: WorkbookSheetLayout = {
    sheetId: SUMMARY_SHEET_ID,
    kind: "summary",
    billId: null,
    name: previousSummary?.name ?? uniqueSheetName("Summary", taken),
    label: "Summary",
    firstBodyRow: SUMMARY_FIRST_BODY_ROW,
    freeColumnStart: SUMMARY_FREE_COLUMN_START,
    columns: SUMMARY_COLUMNS,
    bindings: [],
    billSlots: billSlotsFor(source, previousSummary?.billSlots ?? []),
  };

  const rowsByBill = new Map<string, PreconBoqRowRow[]>();
  for (const row of source.rows) {
    const existing = rowsByBill.get(row.bill_id);
    if (existing) existing.push(row);
    else rowsByBill.set(row.bill_id, [row]);
  }

  // Bill sheets in slot order, so a bill that has gone keeps its tab position
  // rather than jumping to the end of the workbook.
  const orderedBillIds = summary.billSlots!.map((slot) => slot.billId);
  const titleById = new Map(source.bills.map((bill) => [bill.id, bill.title]));

  const billSheets = orderedBillIds.map((billId, index): WorkbookSheetLayout => {
    const sheetId = billSheetIdFor(billId);
    const recorded = previousById.get(sheetId);
    const title = titleById.get(billId) ?? recorded?.label ?? `Bill ${index + 1}`;
    return {
      sheetId,
      kind: "bill",
      billId,
      name: recorded?.name ?? uniqueSheetName(safeSheetName(title, `Bill ${index + 1}`), taken),
      label: title,
      firstBodyRow: BILL_FIRST_BODY_ROW,
      freeColumnStart: BILL_FREE_COLUMN_START,
      columns: BILL_COLUMNS,
      bindings: bindingsFor(rowsByBill.get(billId) ?? [], recorded?.bindings ?? [], source),
    };
  });

  return [summary, ...billSheets];
}

/**
 * The generated sheets plus the user's own, in the order the workbook shows
 * them. Scratch worksheets are discovered from the document rather than stored
 * separately, because the user owns them outright — adding, renaming and
 * removing one needs no server permission and records no binding.
 */
export function withScratchSheets(
  generated: readonly WorkbookSheetLayout[],
  sheetOrder: readonly string[],
  nameOf: (sheetId: string) => string,
): WorkbookLayout {
  const generatedById = new Map(generated.map((sheet) => [sheet.sheetId, sheet]));
  const scratchOf = (sheetId: string): WorkbookSheetLayout => ({
    sheetId,
    kind: "scratch",
    billId: null,
    name: nameOf(sheetId),
    label: nameOf(sheetId),
    firstBodyRow: 0,
    freeColumnStart: 0,
    columns: Object.freeze({}),
    bindings: [],
  });

  // Tab order is the user's, so it is taken from the document. A generated
  // worksheet the document does not list is appended rather than dropped — the
  // save that omitted it is refused separately, and a read must still be whole.
  const seen = new Set<string>();
  const sheets: WorkbookSheetLayout[] = [];
  for (const sheetId of sheetOrder) {
    if (seen.has(sheetId)) continue;
    seen.add(sheetId);
    sheets.push(generatedById.get(sheetId) ?? scratchOf(sheetId));
  }
  for (const sheet of generated) {
    if (!seen.has(sheet.sheetId)) sheets.push(sheet);
  }
  return { schemaVersion: 1, sheets };
}

export { WORKBOOK_ENGINE_VERSION };
