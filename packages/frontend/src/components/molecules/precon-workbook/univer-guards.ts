// Refusing a keystroke, a paste and a fill that would land on a measured
// figure.
//
// The server refuses these too, and its refusal is the one that matters. These
// exist so the refusal arrives at the keystroke instead of three seconds later
// at the save — and, more importantly, so a paste that straddles the boundary
// cannot half-succeed in the grid and leave the user looking at numbers the
// server will never store.
//
// Every guard stands down while `appWrites` is raised. That is the escape the
// application needs to write a remeasured quantity into a cell it has itself
// locked: without it, "the source moved" could never be reflected.

import { isEditableCell } from "./protected";
import type { WorkbookLayout, WorkbookSheetLayout } from "@/api/workbook-types";
import type { FUniver } from "@univerjs/presets";

export interface GuardRefusal {
  readonly sheetLabel: string;
  readonly reason: string;
  readonly at: number;
}

interface RangeLike {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

export interface GuardHost {
  /** The layout as it is NOW. Read through a getter: a remeasure replaces it. */
  layout(): WorkbookLayout;
  onRefused(refusal: GuardRefusal): void;
  onDirty(): void;
}

/** Raised while the application, not the user, is writing. */
export class AppWriteDepth {
  private depth = 0;

  get raised(): boolean {
    return this.depth > 0;
  }

  async during<T>(write: () => T | Promise<T>): Promise<T> {
    this.depth += 1;
    try {
      return await write();
    } finally {
      this.depth -= 1;
    }
  }
}

const REFUSAL_REASONS: Readonly<Record<string, string>> = {
  qty: "Quantities come from the drawings. Use Remeasure on this line to change one.",
  unit: "The unit comes from how the line was measured.",
  amount: "The amount is the quantity times the rate. Change the rate instead.",
  code: "The code is generated with the bill.",
  label: "This label is generated from the bill.",
};

function reasonFor(sheet: WorkbookSheetLayout, row: number, column: number): string {
  const field = sheet.columns[String(column)];
  if (field && REFUSAL_REASONS[field]) return REFUSAL_REASONS[field]!;
  if (row < sheet.firstBodyRow) return "Column headings are generated with the bill.";
  const binding = sheet.bindings.find((entry) => entry.gridRow === row);
  if (binding?.state === "withdrawn") return "This bill line has been withdrawn from the take-off.";
  if (binding === undefined) {
    return `This row is reserved for the next measured line. Column ${sheet.freeColumnStart + 1} onwards is yours.`;
  }
  return "This cell is generated from the bill.";
}

/**
 * Commands that act on the CURRENT SELECTION and carry no range of their own.
 * Only these may fall back to the active range; anything else that arrives
 * without a range addresses no cell and is left alone.
 */
const SELECTION_COMMANDS: ReadonlySet<string> = new Set([
  "sheet.command.clear-selection-content",
  "sheet.command.clear-selection-all",
  "sheet.command.clear-selection-format",
  "sheet.command.auto-clear-content",
  "sheet.command.text-to-number",
  "sheet.command.split-text-to-columns",
  "sheet.command.toggle-cell-checkbox",
]);

/** Commands that act on a WORKSHEET rather than on cells. */
const WORKSHEET_COMMANDS: ReadonlySet<string> = new Set([
  "sheet.command.insert-sheet",
  "sheet.command.copy-sheet",
  "sheet.command.remove-sheet",
  "sheet.command.set-worksheet-name",
  "sheet.command.set-worksheet-order",
  "sheet.command.set-worksheet-activate",
  "sheet.command.set-worksheet-hidden",
  "sheet.command.set-worksheet-show",
  "sheet.command.set-tab-color",
]);

/**
 * Worksheet commands that would destroy a generated worksheet's identity. A
 * bill's tab may be reordered, hidden or coloured; it may not be removed or
 * renamed, because its name is what every cross-sheet formula spells.
 */
const IDENTITY_COMMANDS: Readonly<Record<string, string>> = {
  "sheet.command.remove-sheet": "A bill's worksheet cannot be removed. Add your own worksheet for working notes.",
  "sheet.command.set-worksheet-name":
    "A bill's worksheet keeps its name, because every formula that reads it spells that name.",
};

/**
 * What a worksheet-level command should be refused for, or `null` to allow it.
 *
 * Creating a worksheet is always allowed — whatever cell is selected, and
 * whatever worksheet is in front. A new worksheet cannot be a generated one:
 * the engine mints its own id, and a candidate claiming a reserved `wb-` id is
 * refused at save time anyway.
 */
export function worksheetTargetOf(
  commandId: string,
  params: unknown,
  activeSheet: () => WorkbookSheetLayout | null,
  sheetOf: (sheetId: string) => WorkbookSheetLayout | undefined,
): { sheet: WorkbookSheetLayout; reason: string } | null {
  const reason = IDENTITY_COMMANDS[commandId];
  if (reason === undefined) return null;

  const subUnitId = (params as { subUnitId?: unknown } | undefined)?.subUnitId;
  const target = typeof subUnitId === "string" ? (sheetOf(subUnitId) ?? null) : activeSheet();
  // Unknown to the layout means a scratch worksheet added since the last read.
  if (target === null || target.kind === "scratch") return null;
  return { sheet: target, reason };
}

/** The first cell of `range` the person is not allowed to write to. */
function firstLockedCell(
  sheet: WorkbookSheetLayout,
  range: RangeLike,
): { row: number; column: number } | null {
  for (let row = range.startRow; row <= range.endRow; row += 1) {
    for (let column = range.startColumn; column <= range.endColumn; column += 1) {
      if (!isEditableCell(sheet, row, column)) return { row, column };
    }
  }
  return null;
}

export function installWorkbookGuards(api: FUniver, host: GuardHost, appWrites: AppWriteDepth): () => void {
  const disposers: { dispose(): void }[] = [];
  const sheetOf = (sheetId: string): WorkbookSheetLayout | undefined =>
    host.layout().sheets.find((sheet) => sheet.sheetId === sheetId);

  const refuse = (sheet: WorkbookSheetLayout, reason: string): void => {
    host.onRefused({ sheetLabel: sheet.label, reason, at: Date.now() });
  };

  const activeRange = (): { sheet: WorkbookSheetLayout; range: RangeLike } | null => {
    const worksheet = api.getActiveWorkbook()?.getActiveSheet();
    if (!worksheet) return null;
    const sheet = sheetOf(worksheet.getSheetId());
    const range = worksheet.getSelection()?.getActiveRange()?.getRange();
    return sheet && range ? { sheet, range } : null;
  };

  disposers.push(
    api.addEvent(api.Event.BeforeSheetEditStart, (params) => {
      if (appWrites.raised) return;
      const sheet = sheetOf(params.worksheet.getSheetId());
      if (!sheet || isEditableCell(sheet, params.row, params.column)) return;
      params.cancel = true;
      refuse(sheet, reasonFor(sheet, params.row, params.column));
    }),
  );

  disposers.push(
    api.addEvent(api.Event.BeforeClipboardPaste, (params) => {
      if (appWrites.raised) return;
      const active = activeRange();
      if (!active) return;
      const locked = firstLockedCell(active.sheet, active.range);
      if (!locked) return;
      // The WHOLE paste goes, never the half that would have been allowed:
      // a partly-applied paste is the one outcome the plan forbids outright.
      params.cancel = true;
      refuse(active.sheet, `Nothing was pasted. ${reasonFor(active.sheet, locked.row, locked.column)}`);
    }),
  );

  // Fill handles, the delete key, "clear contents" — every path that writes a
  // range without opening the cell editor.
  //
  // A command is judged against cell addresses only when it ADDRESSES CELLS;
  // worksheet-level commands are judged by the worksheet they target. Falling
  // back to "whatever cell is selected" is how Add sheet came to be refused for
  // a column the user never touched.
  disposers.push(
    api.addEvent(api.Event.BeforeCommandExecute, (event) => {
      if (appWrites.raised) return;
      if (!event.id.startsWith("sheet.command.")) return;

      if (WORKSHEET_COMMANDS.has(event.id)) {
        const target = worksheetTargetOf(event.id, event.params, () => activeRange()?.sheet ?? null, sheetOf);
        if (target === null) return;
        event.cancel = true;
        refuse(target.sheet, target.reason);
        return;
      }

      const params = event.params as { range?: RangeLike; ranges?: RangeLike[] } | undefined;
      const ranges = [params?.range, ...(params?.ranges ?? [])].filter(Boolean) as RangeLike[];
      const active = activeRange();
      // The selection stands in ONLY for the commands that genuinely operate on
      // it — the delete key and the clear-contents family carry no range.
      const candidates =
        ranges.length > 0 ? ranges : SELECTION_COMMANDS.has(event.id) && active ? [active.range] : [];
      const sheet = active?.sheet;
      if (!sheet || candidates.length === 0) return;

      for (const range of candidates) {
        const locked = firstLockedCell(sheet, range);
        if (!locked) continue;
        event.cancel = true;
        refuse(sheet, reasonFor(sheet, locked.row, locked.column));
        return;
      }
    }),
  );

  // A generated worksheet's NAME is what every cross-sheet formula spells, and
  // its presence is what the bill needs. Neither is the user's to change.
  disposers.push(
    api.addEvent(api.Event.BeforeSheetNameChange, (event) => {
      if (appWrites.raised) return;
      const sheet = sheetOf(event.worksheet.getSheetId());
      if (!sheet || sheet.kind === "scratch") return;
      event.cancel = true;
      refuse(sheet, "A bill's worksheet keeps its name, because every formula that reads it spells that name.");
    }),
  );

  disposers.push(
    api.addEvent(api.Event.BeforeSheetDelete, (event) => {
      if (appWrites.raised) return;
      const sheet = sheetOf(event.worksheet.getSheetId());
      if (!sheet || sheet.kind === "scratch") return;
      event.cancel = true;
      refuse(sheet, "A bill's worksheet cannot be removed. Add your own worksheet for working notes.");
    }),
  );

  disposers.push(
    api.addEvent(api.Event.SheetValueChanged, () => {
      if (appWrites.raised) return;
      host.onDirty();
    }),
  );

  for (const event of ["SheetCreated", "SheetDeleted", "SheetNameChanged", "SheetMoved"] as const) {
    disposers.push(
      api.addEvent(api.Event[event], () => {
        if (appWrites.raised) return;
        host.onDirty();
      }),
    );
  }

  return () => {
    for (const disposer of disposers) disposer.dispose();
  };
}
