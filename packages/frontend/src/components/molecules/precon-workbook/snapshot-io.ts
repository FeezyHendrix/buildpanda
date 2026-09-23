// Between Univer's document and the one the take-off API accepts.
//
// The server parses a CLOSED subset: a workbook may carry only
// `id/name/sheetOrder/sheets/styles`, a worksheet only
// `id/name/rowCount/columnCount/cellData`, and a cell only `v/f/s/t`. Univer's
// own `save()` returns more than that — `appVersion`, `locale`, `resources`,
// and per cell `p` (rich text), `si` (shared-formula index) and `custom`. Send
// any of them and the whole save is refused.
//
// So this module narrows. What it must never do is narrow SILENTLY: a formula
// that lived in `si`, or text that lived in `p`, would vanish from a document
// the user was then told had saved. Every field that cannot be carried is
// reported as a note, and the caller refuses the save rather than shipping a
// quietly smaller workbook.
//
// One field IS rewritten rather than dropped. Univer may store a cell's style
// inline as an object where the API wants an id into the style table, so an
// inline style is hoisted into that table under a generated id. Formatting
// survives; the contract is kept.

import { generatedStyleFor, WORKBOOK_STYLES } from "./workbook-styles";
import type {
  WorkbookCell,
  WorkbookCellMatrix,
  WorkbookCellType,
  WorkbookCellValue,
  WorkbookDocument,
  WorkbookSheet,
  WorkbookSnapshot,
  WorkbookStyle,
} from "@/api/workbook-types";

/** Univer's cell as it comes off `save()`. Everything is `unknown` because it is vendor output. */
export interface RawCell {
  v?: unknown;
  f?: unknown;
  s?: unknown;
  t?: unknown;
  p?: unknown;
  si?: unknown;
  custom?: unknown;
}

export interface RawSheet {
  id?: unknown;
  name?: unknown;
  rowCount?: unknown;
  columnCount?: unknown;
  cellData?: unknown;
}

export interface RawWorkbookData {
  id?: unknown;
  name?: unknown;
  sheetOrder?: unknown;
  sheets?: unknown;
  styles?: unknown;
}

/** Something the narrowing could not carry, named so a person can go and look at it. */
export interface NarrowNote {
  readonly sheetId: string;
  readonly row: number;
  readonly column: number;
  readonly reason: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const CELL_TYPES: readonly WorkbookCellType[] = [1, 2, 3, 4];

function readType(value: unknown): WorkbookCellType | undefined {
  return CELL_TYPES.find((candidate) => candidate === value);
}

function readValue(value: unknown): WorkbookCellValue | undefined {
  if (value === null) return null;
  if (typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  return undefined;
}

// ------------------------------------------------------------- style hoisting

/**
 * Collects the workbook's style table while narrowing, so an inline style
 * object on a cell becomes a real entry rather than a refusal.
 *
 * Ids are content-addressed through a map rather than counted per call, so the
 * same formatting used in fifty cells produces one entry and the same document
 * serialized twice produces the same ids.
 */
class StyleTable {
  private readonly table: Record<string, WorkbookStyle> = {};
  private readonly byContent = new Map<string, string>();
  private next = 1;

  constructor(raw: unknown) {
    if (!isObject(raw)) return;
    for (const [id, style] of Object.entries(raw)) {
      if (!isObject(style)) continue;
      this.table[id] = style;
      this.byContent.set(JSON.stringify(style), id);
    }
  }

  /** The id this cell should carry, or `undefined` when it has no usable style. */
  idFor(raw: unknown): string | undefined {
    if (typeof raw === "string") return raw in this.table ? raw : undefined;
    if (!isObject(raw)) return undefined;
    const key = JSON.stringify(raw);
    const existing = this.byContent.get(key);
    if (existing !== undefined) return existing;
    let id = `bp-s${this.next}`;
    while (id in this.table) {
      this.next += 1;
      id = `bp-s${this.next}`;
    }
    this.table[id] = raw;
    this.byContent.set(key, id);
    this.next += 1;
    return id;
  }

  entries(): Record<string, WorkbookStyle> {
    return this.table;
  }
}

// -------------------------------------------------------------- cell narrowing

export interface NarrowedCell {
  readonly cell: WorkbookCell | null;
  readonly note: string | null;
}

/**
 * One cell, reduced to `v/f/s/t`.
 *
 * A FORMULA CELL LOSES ITS CACHED FIGURE. Univer stores the last calculated
 * value beside the formula; the server stores formulas and recalculates, and
 * its generated formula cells carry `{f}` and nothing else. Echoing
 * `{f, v: 3670, t: 2}` back at a generated total is therefore a refusal — and
 * for a user's own formula it would persist a figure that is a cache the
 * moment a measurement moves.
 */
export function narrowCell(raw: RawCell, styles: StyleTable): NarrowedCell {
  const formula = typeof raw.f === "string" && raw.f !== "" ? raw.f : undefined;

  if (formula === undefined && raw.si !== undefined && raw.si !== null) {
    return {
      cell: null,
      note: "this cell shares a formula with its neighbours in a way the take-off workbook cannot store",
    };
  }
  if (raw.p !== undefined && raw.p !== null && typeof raw.v !== "number" && typeof raw.v !== "string") {
    return { cell: null, note: "this cell holds rich text, which the take-off workbook does not store" };
  }

  const cell: { v?: WorkbookCellValue; f?: string; s?: string; t?: WorkbookCellType } = {};
  if (formula !== undefined) {
    cell.f = formula;
  } else {
    const value = readValue(raw.v);
    if (value !== undefined) cell.v = value;
    const type = readType(raw.t);
    if (type !== undefined) cell.t = type;
  }

  const styleId = styles.idFor(raw.s);
  if (styleId !== undefined) cell.s = styleId;

  // An empty object is a cell Univer kept a husk of; it carries nothing, and
  // sending it would spend a populated-cell budget on nothing.
  return { cell: Object.keys(cell).length === 0 ? null : cell, note: null };
}

function narrowMatrix(
  sheetId: string,
  raw: unknown,
  styles: StyleTable,
  notes: NarrowNote[],
): Record<string, Record<string, WorkbookCell>> {
  const matrix: Record<string, Record<string, WorkbookCell>> = {};
  if (!isObject(raw)) return matrix;

  for (const [rowKey, line] of Object.entries(raw)) {
    const row = Number(rowKey);
    if (!Number.isInteger(row) || row < 0 || !isObject(line)) continue;
    const columns: Record<string, WorkbookCell> = {};
    for (const [columnKey, value] of Object.entries(line)) {
      const column = Number(columnKey);
      if (!Number.isInteger(column) || column < 0 || !isObject(value)) continue;
      const { cell, note } = narrowCell(value as RawCell, styles);
      if (note !== null) notes.push({ sheetId, row, column, reason: note });
      if (cell !== null) columns[String(column)] = cell;
    }
    if (Object.keys(columns).length > 0) matrix[String(row)] = columns;
  }
  return matrix;
}

// ----------------------------------------------------------------- narrowing

export interface NarrowResult {
  readonly snapshot: WorkbookSnapshot;
  /** Anything that could not be carried. A non-empty list must block the save. */
  readonly notes: readonly NarrowNote[];
}

const MIN_DIMENSION = 1;

function readCount(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= MIN_DIMENSION ? raw : fallback;
}

/**
 * Univer's document, narrowed to what the API parses.
 *
 * `baseline` supplies a worksheet's dimensions when the vendor document does
 * not, so a sheet never comes back smaller than the bill needs.
 */
export function narrowWorkbook(raw: RawWorkbookData, baseline: WorkbookSnapshot): NarrowResult {
  const styles = new StyleTable(raw.styles);
  const notes: NarrowNote[] = [];
  const sheetsRaw = isObject(raw.sheets) ? raw.sheets : {};

  const order = (Array.isArray(raw.sheetOrder) ? raw.sheetOrder : [])
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .filter((id, index, all) => all.indexOf(id) === index)
    .filter((id) => id in sheetsRaw);

  const sheets: Record<string, WorkbookSheet> = {};
  for (const sheetId of order) {
    const source = (sheetsRaw[sheetId] ?? {}) as RawSheet;
    const before = baseline.sheets[sheetId];
    const cellData = narrowMatrix(sheetId, source.cellData, styles, notes);
    sheets[sheetId] = {
      id: sheetId,
      name: typeof source.name === "string" && source.name !== "" ? source.name : (before?.name ?? sheetId),
      rowCount: readCount(source.rowCount, before?.rowCount ?? MIN_DIMENSION),
      columnCount: readCount(source.columnCount, before?.columnCount ?? MIN_DIMENSION),
      cellData,
    };
  }

  return {
    snapshot: {
      id: typeof raw.id === "string" && raw.id !== "" ? raw.id : baseline.id,
      name: typeof raw.name === "string" && raw.name !== "" ? raw.name : baseline.name,
      sheetOrder: order,
      sheets,
      styles: styles.entries(),
    },
    notes,
  };
}

// --------------------------------------------------------------- the way out

/**
 * The document Univer should open.
 *
 * `cellData` is the server's snapshot verbatim: its generated cells already
 * carry the current measured figures, and its formula cells carry no cached
 * value — Univer calculates those itself the moment the workbook mounts, which
 * is what makes the grid agree with `document.values` without either side
 * copying the other's arithmetic.
 */
export interface UniverWorkbookInput {
  readonly id: string;
  readonly name: string;
  readonly appVersion: string;
  readonly sheetOrder: string[];
  readonly styles: Record<string, WorkbookStyle>;
  /** Vendor extension slot. Always empty: this workbook stores nothing outside its cells. */
  readonly resources: { id?: string; name: string; data: string }[];
  readonly sheets: Record<
    string,
    {
      readonly id: string;
      readonly name: string;
      readonly rowCount: number;
      readonly columnCount: number;
      readonly defaultColumnWidth: number;
      readonly columnData: Record<string, { w: number }>;
      readonly cellData: Record<string, Record<string, WorkbookCell>>;
    }
  >;
}

/** Description columns need room; a figure column does not. */
const COLUMN_WIDTH = 104;
const WIDE_COLUMN_WIDTH = 280;

function columnWidths(document: WorkbookDocument, sheetId: string): Record<string, { w: number }> {
  const layout = document.layout.sheets.find((sheet) => sheet.sheetId === sheetId);
  if (!layout) return {};
  const widths: Record<string, { w: number }> = {};
  for (const [column, field] of Object.entries(layout.columns)) {
    if (field === "description" || field === "label") widths[column] = { w: WIDE_COLUMN_WIDTH };
  }
  return widths;
}

function withGeneratedStylingWhereUnstyled(
  document: WorkbookDocument,
  sheetId: string,
  cellData: WorkbookCellMatrix,
): Record<string, Record<string, WorkbookCell>> {
  const layout = document.layout.sheets.find((sheet) => sheet.sheetId === sheetId);
  const decorated = structuredClone(cellData) as Record<string, Record<string, WorkbookCell>>;
  if (!layout || layout.kind === "scratch") return decorated;

  for (const [rowKey, line] of Object.entries(decorated)) {
    for (const [columnKey, cell] of Object.entries(line)) {
      if (cell.s !== undefined) continue;
      const style = generatedStyleFor(layout, Number(rowKey), Number(columnKey));
      if (style !== null) line[columnKey] = { ...cell, s: style };
    }
  }
  return decorated;
}

export function toUniverWorkbook(document: WorkbookDocument): UniverWorkbookInput {
  const sheets: UniverWorkbookInput["sheets"] = {};
  for (const sheetId of document.snapshot.sheetOrder) {
    const sheet = document.snapshot.sheets[sheetId];
    if (!sheet) continue;
    sheets[sheetId] = {
      id: sheet.id,
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      defaultColumnWidth: COLUMN_WIDTH,
      columnData: columnWidths(document, sheetId),
      cellData: withGeneratedStylingWhereUnstyled(document, sheetId, sheet.cellData),
    };
  }
  return {
    id: document.snapshot.id,
    name: document.snapshot.name,
    appVersion: document.engineVersion,
    sheetOrder: [...document.snapshot.sheetOrder],
    styles: { ...WORKBOOK_STYLES, ...(structuredClone(document.snapshot.styles) as Record<string, WorkbookStyle>) },
    resources: [],
    sheets,
  };
}
