// How wide each column is drawn, and which are folded away on a phone.
//
// PRESENTATION ONLY. Nothing here moves a cell, renumbers a column or touches a
// binding: `gridRow` and the column indices in `layout.columns` are the server's
// and are identical at every width. A hidden column is still addressable, still
// holds its value, and still answers a formula — `=SUM(D2:D4)` reads the same
// figures whether or not D is on screen — and the worksheet keeps its full
// formula editing either way.
//
// The problem it solves: a 280px description column on a 325px grid leaves
// room for nothing else, so a phone shows one column of prose and no figures.
// At that width the three a quantity surveyor actually reads — description,
// unit, qty — are made to fit together, and everything else stays reachable by
// scrolling sideways or unhiding from the worksheet's own column menu.

import type { WorkbookField, WorkbookSheetLayout } from "@/api/workbook-types";

export interface ColumnPresentation {
  readonly index: number;
  readonly width: number;
  readonly hidden: boolean;
}

/** Roomy enough for a bill line's prose; the default everywhere above a phone. */
const WIDE: Readonly<Record<WorkbookField, number>> = {
  code: 72,
  description: 280,
  unit: 64,
  qty: 88,
  rate: 96,
  amount: 104,
  label: 280,
};

/**
 * Phone widths. Description keeps enough for roughly three words per line and
 * the two figures beside it stay whole, which is what makes a line readable
 * without scrolling. `code` is folded away rather than shrunk: it is blank on
 * every generated line in practice, so it costs width and says nothing.
 */
const NARROW: Readonly<Record<WorkbookField, number>> = {
  code: 56,
  description: 148,
  unit: 44,
  qty: 62,
  rate: 72,
  amount: 84,
  label: 156,
};

const FREE_COLUMN_WIDTH = { wide: 104, narrow: 84 } as const;

/** Folded away on a phone. Reachable again from the worksheet's column menu. */
const HIDDEN_ON_PHONE: ReadonlySet<WorkbookField> = new Set<WorkbookField>(["code"]);

/** How many free columns past the generated block get an explicit width. */
const FREE_COLUMNS_SIZED = 8;

export function columnPresentation(sheet: WorkbookSheetLayout, compact: boolean): ColumnPresentation[] {
  const widths = compact ? NARROW : WIDE;
  const columns: ColumnPresentation[] = [];

  if (sheet.kind === "scratch") return columns;

  for (const [index, field] of Object.entries(sheet.columns)) {
    columns.push({
      index: Number(index),
      width: widths[field],
      hidden: compact && HIDDEN_ON_PHONE.has(field),
    });
  }

  const free = compact ? FREE_COLUMN_WIDTH.narrow : FREE_COLUMN_WIDTH.wide;
  for (let offset = 0; offset < FREE_COLUMNS_SIZED; offset += 1) {
    columns.push({ index: sheet.freeColumnStart + offset, width: free, hidden: false });
  }

  return columns.sort((a, b) => a.index - b.index);
}

/**
 * What the three columns a surveyor reads occupy together, used to check a
 * phone can actually show them side by side.
 */
export function readableWidth(sheet: WorkbookSheetLayout, compact: boolean): number {
  const wanted: ReadonlySet<WorkbookField> = new Set<WorkbookField>(["description", "unit", "qty"]);
  return columnPresentation(sheet, compact)
    .filter((column) => !column.hidden)
    .filter((column) => {
      const field = sheet.columns[String(column.index)];
      return field !== undefined && wanted.has(field);
    })
    .reduce((total, column) => total + column.width, 0);
}
