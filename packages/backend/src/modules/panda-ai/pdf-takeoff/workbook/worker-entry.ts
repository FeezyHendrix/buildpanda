// One workbook calculation, in a thread of its own.
//
// This file is a worker entry, not a library: importing it runs a job. It is
// the ONLY place Univer is loaded, which is what makes the isolation real. The
// spike reproduced the failure this prevents — six concurrent in-process Univer
// instances sharing one workbook id returned each other's numbers, while six
// worker threads with fresh module contexts returned six correct answers. A
// parent that imported Univer would put a registry back in the shared process
// and quietly undo that.
//
// Order matters and is not negotiable: settle, then gate the engine's own
// dependency graph for cycles, and only then read a value for persistence. A
// cyclic workbook produces plausible numbers that move on every recalculation,
// so reading before gating would publish a figure that cannot be reproduced.

import { isMainThread, parentPort, workerData } from "node:worker_threads";
import { UniverSheetsNodeCorePreset, type FWorkbook } from "@univerjs/preset-sheets-node-core";
import enUsLocale from "@univerjs/preset-sheets-node-core/locales/en-US";
import {
  CellValueType,
  createUniver,
  LocaleType,
  type ICellData,
  type ILanguagePack,
  type IObjectMatrixPrimitiveType,
  type IWorkbookData,
  type IWorksheetData,
} from "@univerjs/presets";
import { assertAcyclic } from "./cycle-graph.ts";
import { rejectWorkbook, toRejectionWire } from "./engine-errors.ts";
import {
  isWorkbookErrorCode,
  type CalculatedCell,
  type WorkbookCellError,
  type WorkbookCellType,
  type WorkbookCellValue,
  type WorkbookJob,
  type WorkbookJobSuccess,
  type WorkbookSnapshot,
  type WorkbookWorkerMessage,
} from "./engine-types.ts";

// The vendor ships its locale bundles typed `any`. Naming the type here is the
// one place that `any` is allowed to stop, so nothing downstream inherits it.
const EN_US: ILanguagePack = enUsLocale;

const CELL_VALUE_TYPES: Readonly<Record<WorkbookCellType, CellValueType>> = {
  1: CellValueType.STRING,
  2: CellValueType.NUMBER,
  3: CellValueType.BOOLEAN,
  4: CellValueType.FORCE_STRING,
};

/**
 * The calculable half of a validated workbook.
 *
 * Styles and style references are deliberately not handed to the engine:
 * formatting cannot change an arithmetic result, and the answer this worker
 * returns is paired with the caller's own validated snapshot, so nothing the
 * user wrote is lost by leaving presentation out of the calculation.
 */
function toEngineWorkbook(snapshot: WorkbookSnapshot): Partial<IWorkbookData> {
  const sheets: Record<string, Partial<IWorksheetData>> = {};

  for (const sheetId of snapshot.sheetOrder) {
    const sheet = snapshot.sheets[sheetId];
    if (sheet === undefined) continue;
    const cellData: IObjectMatrixPrimitiveType<ICellData> = {};

    for (const [rowKey, row] of Object.entries(sheet.cellData)) {
      const columns: Record<number, ICellData> = {};
      for (const [columnKey, cell] of Object.entries(row)) {
        const target: ICellData = {};
        if (cell.v !== undefined) target.v = cell.v;
        if (cell.f !== undefined) target.f = cell.f;
        if (cell.t !== undefined) target.t = CELL_VALUE_TYPES[cell.t];
        columns[Number(columnKey)] = target;
      }
      cellData[Number(rowKey)] = columns;
    }

    sheets[sheetId] = {
      id: sheet.id,
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      cellData,
    };
  }

  return { id: snapshot.id, name: snapshot.name, sheetOrder: [...snapshot.sheetOrder], sheets };
}

/**
 * An engine answer that is not a usable figure.
 *
 * A spreadsheet error arrives as its own text — the spike confirmed `=1/0`
 * reads back as the string "#DIV/0!" rather than 0 — and a non-finite number
 * arrives as a number that would survive straight into a bill. Both become an
 * explicit error with a `null` value, because the one thing neither may become
 * is zero.
 */
function errorCodeOf(value: WorkbookCellValue, hasFormula: boolean): WorkbookCellError["code"] | null {
  if (typeof value === "number" && !Number.isFinite(value)) return "NON_FINITE";
  if (hasFormula && typeof value === "string" && isWorkbookErrorCode(value)) return value;
  return null;
}

function readValues(workbook: FWorkbook, snapshot: WorkbookSnapshot): WorkbookJobSuccess {
  const values: Record<string, Record<string, Record<string, CalculatedCell>>> = {};
  const errors: WorkbookCellError[] = [];
  let populatedCells = 0;

  for (const sheetId of snapshot.sheetOrder) {
    const sheet = snapshot.sheets[sheetId];
    if (sheet === undefined) continue;
    const worksheet = workbook.getSheetBySheetId(sheetId);
    if (worksheet === null) {
      rejectWorkbook("engine_failure", `engine lost worksheet "${sheetId}" during calculation`);
    }

    const rows: Record<string, Record<string, CalculatedCell>> = {};
    for (const [rowKey, row] of Object.entries(sheet.cellData)) {
      const columns: Record<string, CalculatedCell> = {};

      for (const [columnKey, cell] of Object.entries(row)) {
        populatedCells += 1;
        if (cell.v === undefined && cell.f === undefined) continue;

        const rowIndex = Number(rowKey);
        const columnIndex = Number(columnKey);
        const formula = cell.f ?? null;
        const raw = worksheet.getRange(rowIndex, columnIndex).getValue() ?? null;
        const code = errorCodeOf(raw, formula !== null);

        if (code !== null) {
          errors.push({ sheetId, row: rowIndex, column: columnIndex, formula, code });
          columns[columnKey] = { value: null, formula };
        } else {
          columns[columnKey] = { value: raw, formula };
        }
      }

      if (Object.keys(columns).length > 0) rows[rowKey] = columns;
    }

    values[sheetId] = rows;
  }

  return { values, errors, populatedCells };
}

async function runJob(job: WorkbookJob): Promise<WorkbookJobSuccess> {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.EN_US,
    locales: { [LocaleType.EN_US]: EN_US },
    presets: [UniverSheetsNodeCorePreset()],
  });

  try {
    const workbook = univerAPI.createWorkbook(toEngineWorkbook(job.snapshot));
    const formula = univerAPI.getFormula();
    await formula.onCalculationResultApplied(job.settleTimeoutMs);

    assertAcyclic(await formula.getAllDependencyTrees(job.settleTimeoutMs), {
      maxGraphNodes: job.maxGraphNodes,
      maxGraphEdges: job.maxGraphEdges,
      maxReportedCycles: job.maxReportedCycles,
    });

    return readValues(workbook, job.snapshot);
  } finally {
    // Always: a worker that leaked an engine would be terminated by the parent
    // anyway, but a job that fails must not be the reason a dispose is skipped.
    univer.dispose();
  }
}

async function main(): Promise<void> {
  const port = parentPort;
  if (isMainThread || port === null) {
    throw new Error("worker-entry.ts is a worker thread entry point; it cannot be run on the main thread");
  }

  const post = (message: WorkbookWorkerMessage): void => {
    port.postMessage(message);
  };

  try {
    post({ ok: true, result: await runJob(workerData as WorkbookJob) });
  } catch (error) {
    post({ ok: false, rejection: toRejectionWire(error) });
  }
}

await main();
