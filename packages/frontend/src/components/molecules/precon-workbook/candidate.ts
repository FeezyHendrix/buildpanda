// Turning what is on screen into what the server is asked to store.
//
// The grid holds one document; the API wants two things out of it — a workbook
// whose generated half still says exactly what the bill says, and an explicit
// list of the rate and description changes that are allowed to move. This
// builds both, and refuses to build either quietly.
//
// Protected cells are REBUILT from the server's own snapshot rather than echoed
// out of the grid. That is the whole trick: the sanitizer compares the
// candidate against what it would render right now, so reconstructing those
// cells from the same source it renders them from makes them equal by
// construction. Only `s` is taken from the grid, because formatting is the
// user's and the server ignores it.
//
// Anything a person did inside the generated block that ISN'T a rate or a
// description comes back as a `BlockedEdit`. It is never stripped: a save that
// silently discards half a paste is a save that lied.

import {
  bindingsByGridRow,
  classifyProtectedChange,
  ownedRows,
  projectPatchedRow,
  sameMeaning,
  toRowPatches,
  type BlockedEdit,
  type DerivedPatch,
} from "./protected";
import { narrowWorkbook, type NarrowNote, type RawWorkbookData } from "./snapshot-io";
import type {
  WorkbookCell,
  WorkbookDocument,
  WorkbookRowPatch,
  WorkbookSheet,
  WorkbookSheetLayout,
  WorkbookSnapshot,
} from "@/api/workbook-types";

export interface Candidate {
  readonly snapshot: WorkbookSnapshot;
  readonly rowPatches: readonly WorkbookRowPatch[];
  /** Edits inside the generated block the server would refuse. Non-empty blocks the save. */
  readonly blocked: readonly BlockedEdit[];
  /** Cell content the narrowing could not carry. Non-empty blocks the save. */
  readonly notes: readonly NarrowNote[];
}

/** A generated sheet is unusable as a whole, not cell by cell. */
function sheetLevelRefusal(layout: WorkbookSheetLayout, sheet: WorkbookSheet | undefined): string | null {
  if (!sheet) return "this worksheet was removed from the workbook, and a bill's worksheet cannot be deleted";
  if (sheet.name !== layout.name) {
    return `this worksheet was renamed to "${sheet.name}", which would break every formula that spells its name`;
  }
  return null;
}

const GENERATED_ID_PREFIXES = ["wb-summary", "wb-bill-"] as const;
const isGeneratedSheetId = (id: string): boolean =>
  GENERATED_ID_PREFIXES.some((prefix) => id === prefix || id.startsWith(prefix));

/** Every protected address either side knows about, so a NEW cell counts too. */
function protectedAddresses(
  baseline: WorkbookSheet | undefined,
  candidate: WorkbookSheet | undefined,
  freeColumnStart: number,
): Map<number, Set<number>> {
  const addresses = new Map<number, Set<number>>();
  for (const sheet of [baseline, candidate]) {
    for (const [rowKey, line] of Object.entries(sheet?.cellData ?? {})) {
      const row = Number(rowKey);
      for (const columnKey of Object.keys(line)) {
        const column = Number(columnKey);
        if (column >= freeColumnStart) continue;
        const columns = addresses.get(row) ?? new Set<number>();
        columns.add(column);
        addresses.set(row, columns);
      }
    }
  }
  return addresses;
}

const cellAt = (sheet: WorkbookSheet | undefined, row: number, column: number): WorkbookCell | undefined =>
  sheet?.cellData[String(row)]?.[String(column)];

interface SheetReview {
  readonly patches: readonly DerivedPatch[];
  readonly blocked: readonly BlockedEdit[];
}

/** What a person did to one generated worksheet's protected half. */
function reviewGeneratedSheet(
  layout: WorkbookSheetLayout,
  baseline: WorkbookSheet | undefined,
  candidate: WorkbookSheet | undefined,
): SheetReview {
  const blocked: BlockedEdit[] = [];
  const patches: DerivedPatch[] = [];
  const refuse = (row: number, column: number, reason: string): void => {
    blocked.push({
      sheetId: layout.sheetId,
      sheetLabel: layout.label,
      row,
      column,
      field: layout.columns[String(column)] ?? null,
      reason,
    });
  };

  const whole = sheetLevelRefusal(layout, candidate);
  if (whole !== null) {
    refuse(0, 0, whole);
    return { patches, blocked };
  }

  const owned = ownedRows(layout);
  const bindings = bindingsByGridRow(layout);

  for (const [row, columns] of protectedAddresses(baseline, candidate, layout.freeColumnStart)) {
    for (const column of columns) {
      if (sameMeaning(cellAt(baseline, row, column), cellAt(candidate, row, column))) continue;
      if (!owned.has(row)) {
        refuse(
          row,
          column,
          `that cell is reserved for a bill line that has not been measured yet — ` +
            `column ${layout.freeColumnStart + 1} onwards is yours`,
        );
        continue;
      }
      const change = classifyProtectedChange(layout, bindings.get(row), column, cellAt(candidate, row, column));
      if (change.patch) patches.push(change.patch);
      else refuse(row, column, change.reason ?? "that cell is generated from the bill");
    }
  }

  return { patches, blocked };
}

/** Protected columns from the server's own figures; free columns from the grid. */
function rebuildGeneratedSheet(
  layout: WorkbookSheetLayout,
  baseline: WorkbookSheet | undefined,
  candidate: WorkbookSheet,
  patches: readonly DerivedPatch[],
): WorkbookSheet {
  const patchesByRow = new Map<number, DerivedPatch[]>();
  const rowOf = new Map(layout.bindings.map((binding) => [binding.rowId, binding.gridRow]));
  for (const patch of patches) {
    const row = rowOf.get(patch.rowId);
    if (row === undefined) continue;
    patchesByRow.set(row, [...(patchesByRow.get(row) ?? []), patch]);
  }

  const cellData: Record<string, Record<string, WorkbookCell>> = {};
  const rows = new Set([
    ...Object.keys(baseline?.cellData ?? {}).map(Number),
    ...Object.keys(candidate.cellData).map(Number),
  ]);

  for (const row of [...rows].sort((a, b) => a - b)) {
    const line: Record<string, WorkbookCell> = {};

    // Free half: exactly what the person wrote.
    for (const [columnKey, cell] of Object.entries(candidate.cellData[String(row)] ?? {})) {
      if (Number(columnKey) >= layout.freeColumnStart) line[columnKey] = cell;
    }

    // Generated half: the server's cells, carrying any patch this save applies,
    // with the person's formatting laid back over the top.
    const generated = projectPatchedRow(
      layout,
      Object.fromEntries(
        Object.entries(baseline?.cellData[String(row)] ?? {}).filter(
          ([columnKey]) => Number(columnKey) < layout.freeColumnStart,
        ),
      ),
      patchesByRow.get(row) ?? [],
    );
    for (const [columnKey, cell] of Object.entries(generated)) {
      const style = candidate.cellData[String(row)]?.[columnKey]?.s;
      line[columnKey] = style === undefined ? cell : { ...cell, s: style };
    }

    if (Object.keys(line).length > 0) cellData[String(row)] = line;
  }

  return {
    id: layout.sheetId,
    name: layout.name,
    // A generated worksheet may grow but never shrink: the server refuses one
    // smaller than the bill needs, and the next measured line lands below.
    rowCount: Math.max(candidate.rowCount, baseline?.rowCount ?? 0),
    columnCount: Math.max(candidate.columnCount, baseline?.columnCount ?? 0),
    cellData,
  };
}

/**
 * The save request's two halves, plus everything that stops it being sent.
 *
 * Call this on every save attempt rather than caching it: it is pure, it is
 * cheap next to a round trip, and a stale candidate is how a user ends up
 * saving the workbook they had a minute ago.
 */
export function buildCandidate(raw: RawWorkbookData, document: WorkbookDocument): Candidate {
  const { snapshot: narrowed, notes } = narrowWorkbook(raw, document.snapshot);
  const layouts = document.layout.sheets;
  const blocked: BlockedEdit[] = [];
  const patches: DerivedPatch[] = [];
  const sheets: Record<string, WorkbookSheet> = {};

  for (const layout of layouts) {
    if (layout.kind === "scratch") continue;
    const review = reviewGeneratedSheet(layout, document.snapshot.sheets[layout.sheetId], narrowed.sheets[layout.sheetId]);
    blocked.push(...review.blocked);
    patches.push(...review.patches);
  }

  const generatedIds = new Set(layouts.filter((sheet) => sheet.kind !== "scratch").map((sheet) => sheet.sheetId));
  const order = [...narrowed.sheetOrder];

  for (const sheetId of order) {
    const candidate = narrowed.sheets[sheetId];
    if (!candidate) continue;
    const layout = layouts.find((sheet) => sheet.sheetId === sheetId);
    if (layout && layout.kind !== "scratch") {
      sheets[sheetId] = rebuildGeneratedSheet(layout, document.snapshot.sheets[sheetId], candidate, patches);
      continue;
    }
    if (isGeneratedSheetId(sheetId)) {
      blocked.push({
        sheetId,
        sheetLabel: candidate.name,
        row: 0,
        column: 0,
        field: null,
        reason: "that worksheet id is reserved for a bill generated from the take-off",
      });
      continue;
    }
    sheets[sheetId] = candidate;
  }

  // A generated worksheet the document stopped listing is a deleted tab. The
  // server refuses that, so say so rather than quietly putting it back.
  for (const sheetId of generatedIds) {
    if (order.includes(sheetId)) continue;
    const layout = layouts.find((sheet) => sheet.sheetId === sheetId)!;
    blocked.push({
      sheetId,
      sheetLabel: layout.label,
      row: 0,
      column: 0,
      field: null,
      reason: "a bill's worksheet cannot be removed from the workbook",
    });
    sheets[sheetId] = document.snapshot.sheets[sheetId]!;
    order.push(sheetId);
  }

  return {
    snapshot: { id: narrowed.id, name: narrowed.name, sheetOrder: order, sheets, styles: narrowed.styles },
    rowPatches: toRowPatches(patches),
    blocked,
    notes,
  };
}

/** Nothing may be sent while either list has an entry. */
export function isSendable(candidate: Candidate): boolean {
  return candidate.blocked.length === 0 && candidate.notes.length === 0;
}
