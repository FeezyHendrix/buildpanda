// How much work one workbook calculation is allowed to be.
//
// The first four figures are the plan's own caps. The rest exist because a
// document can be small in cells and still be an allocation attack: a sheet
// that declares a billion rows, a style table with a million entries, or a
// dependency graph that a naive walk would never come back from. Each is
// checked against the work the job WOULD do, before a worker is spawned, so
// exceeding one costs a JSON walk and nothing else.

export interface WorkbookLimits {
  /** Cells carrying a value, a formula or a style, across every worksheet. */
  readonly maxPopulatedCells: number;
  readonly maxSheets: number;
  /** Serialised size of the candidate document. */
  readonly maxInputBytes: number;
  readonly maxFormulaLength: number;
  /** A sheet's declared grid, which the engine allocates against. */
  readonly maxRowCount: number;
  readonly maxColumnCount: number;
  readonly maxStyles: number;
  /** Any single string the document carries: a sheet name, a text cell. */
  readonly maxTextLength: number;
  /** A workbook id, sheet id or style id. */
  readonly maxIdentifierLength: number;
  /** Nodes in the engine's dependency graph the cycle gate will walk. */
  readonly maxGraphNodes: number;
  /** Edges the cycle gate will follow before giving up on the document. */
  readonly maxGraphEdges: number;
  /** Cycles named in a rejection; the rest are counted, not listed. */
  readonly maxReportedCycles: number;
}

export const WORKBOOK_LIMITS: WorkbookLimits = Object.freeze({
  maxPopulatedCells: 10_000,
  maxSheets: 50,
  maxInputBytes: 2 * 1024 * 1024,
  maxFormulaLength: 4096,
  // A takeoff bill is long, not wide. 100k x 1024 is far past any real bill and
  // far short of a grid that would cost real memory to instantiate.
  maxRowCount: 100_000,
  maxColumnCount: 1024,
  maxStyles: 1024,
  maxTextLength: 4096,
  maxIdentifierLength: 128,
  maxGraphNodes: 200_000,
  maxGraphEdges: 1_000_000,
  maxReportedCycles: 10,
});

/** One worker's wall-clock budget, from spawn to settled results. */
export const WORKBOOK_DEADLINE_MS = 15_000;

/**
 * How long a terminated thread is given to actually exit.
 *
 * Separate from the deadline because they bound different things: the deadline
 * bounds the calculation, this bounds the cleanup. Worst-case caller latency is
 * therefore deadline + grace, and a thread that outlives the grace is reported
 * as an engine failure rather than quietly assumed dead.
 */
export const WORKBOOK_TERMINATE_GRACE_MS = 5_000;

/** Jobs calculating at once. The feasibility spike measured ~154 MiB for a second. */
export const WORKBOOK_CONCURRENCY = 1;

/** Jobs allowed to wait. Beyond this the caller is told to retry, not queued forever. */
export const WORKBOOK_QUEUE_DEPTH = 8;

export function resolveLimits(overrides?: Partial<WorkbookLimits>): WorkbookLimits {
  if (overrides === undefined) return WORKBOOK_LIMITS;
  return Object.freeze({ ...WORKBOOK_LIMITS, ...overrides });
}
