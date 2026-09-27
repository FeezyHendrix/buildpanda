// The takeoff workbook calculation engine.
//
// Stable surface for todo 3 (persistence/API), todo 5 (export + Panda AI) and
// anything else that needs a workbook calculated:
//
//   const result = await evaluateWorkbook(candidate, { signal, jobId });
//
//   result.snapshot        the validated candidate, formulas exactly as written
//   result.values          sheetId -> row -> column -> { value, formula }
//   result.errors          cells whose formula produced no usable figure
//   result.populatedCells  what the job cost against the 10000-cell bound
//
// It rejects with `WorkbookRejectedError`; `error.reason` says which refusal it
// was and `WORKBOOK_REJECTION_STATUS` maps that to the status a route returns.
// There is no partial success: a refusal means nothing was calculated.
//
// What it deliberately does NOT do: read or write the database, take a lock,
// decide who is allowed to calculate, or persist anything. Contract 6 puts the
// coherent read and the session lock either side of this call.

export {
  createWorkbookEngine,
  evaluateWorkbook,
  type EvaluateWorkbookOptions,
  type WorkbookEngine,
  type WorkbookEngineConfig,
} from "./engine.ts";

export {
  isWorkbookRejection,
  WORKBOOK_REJECTION_STATUS,
  WorkbookRejectedError,
  type WorkbookRejectionReason,
} from "./engine-errors.ts";

export {
  resolveLimits,
  WORKBOOK_CONCURRENCY,
  WORKBOOK_DEADLINE_MS,
  WORKBOOK_LIMITS,
  WORKBOOK_QUEUE_DEPTH,
  WORKBOOK_TERMINATE_GRACE_MS,
  type WorkbookLimits,
} from "./engine-limits.ts";

export {
  isWorkbookErrorCode,
  WORKBOOK_ERROR_CODES,
  type CalculatedCell,
  type CalculatedCellMatrix,
  type EvaluateWorkbookResult,
  type WorkbookCell,
  type WorkbookCellError,
  type WorkbookCellMatrix,
  type WorkbookCellValue,
  type WorkbookErrorCode,
  type WorkbookSheet,
  type WorkbookSnapshot,
  type WorkbookStyle,
} from "./engine-types.ts";

export { countPopulatedCells, validateWorkbookSnapshot } from "./engine-validation.ts";

export { assertAcyclic, findFormulaCycles, type DependencyNode } from "./cycle-graph.ts";

export {
  liveWorkerCount,
  onWorkerLifecycle,
  workerEntryUrl,
  type WorkerLifecycleEvent,
} from "./worker-client.ts";

// The persisted workbook. The exports above answer "what is this workbook
// worth"; these answer "what is it, who owns it, and what happened to it".
// Todo 5's export and Panda AI reads consume `workbookService.read`, which
// recalculates from the live bill and so cannot hand back a stale figure.

export { workbookService, renderCandidate, renderTrusted, type WorkbookService } from "./service.ts";
export {
  workbookExportService,
  type ProjectNameLookup,
  type WorkbookExportFile,
  type WorkbookExportService,
} from "./export-service.ts";
export { buildWorkbookXlsx, WORKBOOK_EXPORT_LIMITS, type WorkbookExportMeta } from "./export-xlsx.ts";
export { excelSheetNames, rewriteSheetRefs, type ExcelSheetNames } from "./export-names.ts";
export { workbookReverseService } from "./reverse.ts";
export { workbookRoutes } from "./routes.ts";
export { preconWorkbookRepository, type PreconWorkbookRepository } from "./repository.ts";
export { readCoherentState, type WorkbookReadState, type WorkbookSourceSet } from "./source.ts";
export { sourceFingerprint } from "./fingerprint.ts";
export { buildGeneratedLayout, billSheetIdFor, SUMMARY_SHEET_ID, withScratchSheets } from "./layout.ts";
export { sanitizeCandidate, WorkbookProtectedError } from "./sanitize.ts";
export { workbookHistoryService, WORKBOOK_REFUSALS } from "./history.ts";
export * from "./types.ts";
