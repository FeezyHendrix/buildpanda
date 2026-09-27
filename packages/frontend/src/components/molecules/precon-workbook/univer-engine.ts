// The spreadsheet engine, and the only file that imports it.
//
// Everything `@univerjs` lives behind this module and this module is only ever
// reached through a dynamic import, which is what keeps roughly thirteen
// megabytes of engine out of the application's main bundle. Nothing else in
// `precon-workbook/` may import a vendor symbol — the pure modules beside it
// are testable under plain node precisely because they do not.
//
// Vendor chrome is reduced, never capability. The ribbon goes because a QS
// pricing a bill is not looking for WordArt; the formula bar, the worksheet
// tabs and the statistic bar stay, because those ARE the spreadsheet.

import { createUniver, LocaleType, LogLevel, merge } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import sheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import "@univerjs/preset-sheets-core/lib/index.css";

import { columnPresentation } from "./column-presentation";
import { isEditableCell } from "./protected";
import { AppWriteDepth, installWorkbookGuards, type GuardRefusal } from "./univer-guards";
import { toUniverWorkbook, type RawWorkbookData } from "./snapshot-io";
import { WORKBOOK_FONT, WORKBOOK_THEME } from "./univer-theme";
import type { WorkbookCell, WorkbookDocument, WorkbookLayout } from "@/api/workbook-types";
import type { FUniver } from "@univerjs/presets";

// The sheet facades are contributed to `FUniver` by the sheets preset's module
// augmentation rather than exported as names, so they are read back off the API
// instead of imported from a package this one does not declare a dependency on.
type FWorkbook = NonNullable<ReturnType<FUniver["getActiveWorkbook"]>>;
type FWorksheet = NonNullable<ReturnType<FWorkbook["getSheetBySheetId"]>>;

/** Where the user was, so a trip to a drawing and back lands in the same place. */
export interface WorkbookContext {
  readonly sheetId: string | null;
  readonly row: number;
  readonly column: number;
  readonly scrollRow: number;
  readonly scrollColumn: number;
}

export const EMPTY_CONTEXT: WorkbookContext = { sheetId: null, row: 0, column: 0, scrollRow: 0, scrollColumn: 0 };

export interface CellFocus {
  readonly sheetId: string;
  readonly row: number;
  readonly column: number;
  readonly value: string;
  readonly formula: string;
  readonly editable: boolean;
}

export interface EngineCallbacks {
  onDirty(): void;
  onRefused(refusal: GuardRefusal): void;
  onFocusChanged(focus: CellFocus | null): void;
}

export interface WorkbookEngine {
  save(): RawWorkbookData;
  context(): WorkbookContext;
  restore(context: WorkbookContext): void;
  focus(sheetId: string, row: number, column: number): void;
  activeSheetId(): string | null;
  setActiveSheet(sheetId: string): void;
  addScratchSheet(name: string): void;
  renameActiveSheet(name: string): void;
  deleteScratchSheet(sheetId: string): void;
  setCellText(sheetId: string, row: number, column: number, text: string): void;
  undo(): void;
  redo(): void;
  /** Writes the server's figures into bound cells without tripping the guards. */
  applySourceCells(document: WorkbookDocument): Promise<void>;
  /**
   * Column widths and phone folding. Presentation only — it never reaches the
   * wire, because `columnData` is not part of the snapshot the API accepts.
   */
  applyColumnPresentation(compact: boolean): Promise<void>;
  resize(): void;
  dispose(): void;
}

const SELECTION_COMMANDS = new Set(["sheet.operation.set-selections", "sheet.command.move-selection"]);

function readFocus(api: FUniver, layout: WorkbookLayout): CellFocus | null {
  const worksheet = api.getActiveWorkbook()?.getActiveSheet();
  const cell = worksheet?.getSelection()?.getCurrentCell();
  if (!worksheet || !cell) return null;
  const sheetId = worksheet.getSheetId();
  const sheet = layout.sheets.find((entry) => entry.sheetId === sheetId);
  const range = worksheet.getRange(cell.actualRow, cell.actualColumn);
  const value = range.getValue();
  return {
    sheetId,
    row: cell.actualRow,
    column: cell.actualColumn,
    value: value === null || value === undefined ? "" : String(value),
    formula: range.getFormula() ?? "",
    editable: sheet === undefined || isEditableCell(sheet, cell.actualRow, cell.actualColumn),
  };
}

/**
 * Univer stores a dragged-down formula once and points its neighbours at it
 * with `si`. The API's cell grammar has no `si`, so a continuation cell would
 * reach the wire carrying nothing at all. Asking the facade for the formula
 * text turns it back into a cell the API can store, rather than losing it.
 */
function resolveSharedFormulas(api: FUniver, raw: RawWorkbookData): RawWorkbookData {
  const workbook = api.getActiveWorkbook();
  if (!workbook) return raw;
  const sheets = raw.sheets as Record<string, { cellData?: Record<string, Record<string, WorkbookCell>> }>;

  for (const [sheetId, sheet] of Object.entries(sheets ?? {})) {
    const worksheet = workbook.getSheetBySheetId(sheetId);
    if (!worksheet || !sheet.cellData) continue;
    for (const [rowKey, line] of Object.entries(sheet.cellData)) {
      for (const [columnKey, cell] of Object.entries(line)) {
        const shared = cell as WorkbookCell & { si?: unknown };
        if (shared.si === undefined || shared.si === null || typeof shared.f === "string") continue;
        const formula = worksheet.getRange(Number(rowKey), Number(columnKey)).getFormula();
        if (formula) line[columnKey] = { ...cell, f: formula };
      }
    }
  }
  return raw;
}

export interface CreateEngineOptions {
  readonly container: HTMLElement;
  readonly document: WorkbookDocument;
  readonly layout: () => WorkbookLayout;
  readonly callbacks: EngineCallbacks;
}

export function createWorkbookEngine({ container, document, layout, callbacks }: CreateEngineOptions): WorkbookEngine {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: { [LocaleType.EN_US]: merge({}, sheetsCoreEnUS) },
    logLevel: LogLevel.ERROR,
    theme: WORKBOOK_THEME,
    presets: [
      UniverSheetsCorePreset({
        container,
        // `header: false` would also take the formula bar, so the header stays
        // and only the ribbon goes. That is the compact ceiling the engine offers.
        header: true,
        toolbar: false,
        formulaBar: true,
        footer: { sheetBar: true, statisticBar: true, menus: true, zoomSlider: false },
        customFontFamily: [{ value: "Plus Jakarta Sans", label: "Plus Jakarta Sans" }],
      }),
    ],
  });

  container.style.setProperty("--univer-font", WORKBOOK_FONT);
  univerAPI.createWorkbook(toUniverWorkbook(document));

  const appWrites = new AppWriteDepth();
  const removeGuards = installWorkbookGuards(univerAPI, {
    layout,
    onRefused: callbacks.onRefused,
    onDirty: callbacks.onDirty,
  }, appWrites);

  const emitFocus = (): void => callbacks.onFocusChanged(readFocus(univerAPI, layout()));
  const selectionWatch = univerAPI.addEvent(univerAPI.Event.CommandExecuted, (event) => {
    if (SELECTION_COMMANDS.has(event.id)) emitFocus();
  });
  const editWatch = univerAPI.addEvent(univerAPI.Event.SheetEditEnded, emitFocus);
  const sheetWatch = univerAPI.addEvent(univerAPI.Event.ActiveSheetChanged, emitFocus);

  const workbook = (): FWorkbook | null => univerAPI.getActiveWorkbook();
  const sheet = (sheetId: string): FWorksheet | null => workbook()?.getSheetBySheetId(sheetId) ?? null;

  return {
    save: () => resolveSharedFormulas(univerAPI, (workbook()?.save() ?? {}) as RawWorkbookData),

    context: () => {
      const worksheet = workbook()?.getActiveSheet();
      if (!worksheet) return EMPTY_CONTEXT;
      const cell = worksheet.getSelection()?.getCurrentCell();
      const scroll = worksheet.getScrollState();
      return {
        sheetId: worksheet.getSheetId(),
        row: cell?.actualRow ?? 0,
        column: cell?.actualColumn ?? 0,
        scrollRow: scroll?.sheetViewStartRow ?? 0,
        scrollColumn: scroll?.sheetViewStartColumn ?? 0,
      };
    },

    restore: (saved) => {
      if (!saved.sheetId) return;
      const worksheet = sheet(saved.sheetId);
      if (!worksheet) return;
      workbook()?.setActiveSheet(worksheet);
      worksheet.setActiveRange(worksheet.getRange(saved.row, saved.column));
      worksheet.scrollToCell(saved.scrollRow, saved.scrollColumn);
      emitFocus();
    },

    focus: (sheetId, row, column) => {
      const worksheet = sheet(sheetId);
      if (!worksheet) return;
      workbook()?.setActiveSheet(worksheet);
      worksheet.getRange(row, column).activate();
      worksheet.scrollToCell(Math.max(0, row - 3), 0);
      emitFocus();
    },

    activeSheetId: () => workbook()?.getActiveSheet()?.getSheetId() ?? null,

    setActiveSheet: (sheetId) => {
      const worksheet = sheet(sheetId);
      if (worksheet) workbook()?.setActiveSheet(worksheet);
      emitFocus();
    },

    addScratchSheet: (name) => {
      workbook()?.insertSheet(name);
      callbacks.onDirty();
    },

    renameActiveSheet: (name) => {
      workbook()?.getActiveSheet()?.setName(name);
    },

    deleteScratchSheet: (sheetId) => {
      const worksheet = sheet(sheetId);
      if (worksheet) workbook()?.deleteSheet(worksheet);
    },

    setCellText: (sheetId, row, column, text) => {
      const worksheet = sheet(sheetId);
      if (!worksheet) return;
      const numeric = Number(text);
      const isNumber = text.trim() !== "" && Number.isFinite(numeric) && !text.startsWith("=");
      worksheet.getRange(row, column).setValue(isNumber ? numeric : text);
      emitFocus();
    },

    undo: () => void univerAPI.undo(),
    redo: () => void univerAPI.redo(),

    // Only the generated half, and only through the app-write escape: the same
    // cells the guards lock are the cells a remeasure has to move.
    applySourceCells: (fresh) =>
      appWrites.during(() => {
        for (const sheetLayout of fresh.layout.sheets) {
          if (sheetLayout.kind === "scratch") continue;
          const worksheet = sheet(sheetLayout.sheetId);
          const source = fresh.snapshot.sheets[sheetLayout.sheetId];
          if (!worksheet || !source) continue;
          for (const [rowKey, line] of Object.entries(source.cellData)) {
            for (const [columnKey, cell] of Object.entries(line)) {
              if (Number(columnKey) >= sheetLayout.freeColumnStart) continue;
              worksheet
                .getRange(Number(rowKey), Number(columnKey))
                .setValue(cell.f !== undefined ? { f: cell.f } : { v: cell.v ?? null, t: cell.t });
            }
          }
        }
      }),

    // Runs under the app-write escape: hiding a column is a range command over
    // cells the guards lock, and it must not mark the workbook dirty either.
    applyColumnPresentation: (compact) =>
      appWrites.during(() => {
        // `hideColumns`/`showColumns` SELECT the range they act on, and they do
        // it on EVERY worksheet the loop touches — so each one's selection is
        // put back, or switching to a bill lands on its last free column
        // instead of its first line.
        for (const sheetLayout of layout().sheets) {
          const worksheet = sheet(sheetLayout.sheetId);
          if (!worksheet) continue;
          const columns = columnPresentation(sheetLayout, compact);
          if (columns.length === 0) continue;

          const before = worksheet.getSelection()?.getActiveRange()?.getRange() ?? null;
          for (const column of columns) {
            if (column.index >= worksheet.getMaxColumns()) continue;
            worksheet.setColumnWidth(column.index, column.width);
            if (column.hidden) worksheet.hideColumns(column.index, 1);
            else worksheet.showColumns(column.index, 1);
          }
          worksheet.setActiveRange(worksheet.getRange(before?.startRow ?? 0, before?.startColumn ?? 0));
          worksheet.scrollToCell(0, 0);
        }
      }),

    resize: () => void workbook()?.getActiveSheet()?.refreshCanvas(),

    dispose: () => {
      removeGuards();
      selectionWatch.dispose();
      editWatch.dispose();
      sheetWatch.dispose();
      // Must stay synchronous. This logs a dev-only React 19 "unmounted a root
      // while rendering" warning from Univer's own teardown — but deferring it
      // blanks the grid, because a cleanup is followed straight away by the
      // next mount and the late teardown then kills its replacement.
      univer.dispose();
    },
  };
}
