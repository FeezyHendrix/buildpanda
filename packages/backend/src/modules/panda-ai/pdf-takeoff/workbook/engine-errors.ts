// Every way a workbook calculation can be refused, and the status each refusal
// is worth.
//
// One class with a `reason`, not eight classes: a caller that must branch does
// it on a value the compiler checks, and a test asserts the reason rather than
// matching a message. The reason is also what the route layer turns into a
// status, so "too large" cannot drift into a 500 and "busy" cannot drift into
// a 400.
//
// Nothing here is thrown after a partial write, because nothing in this module
// writes: a rejection means the calculation did not happen and no state moved.

import { AppError } from "../../../../lib/errors.ts";

export const WORKBOOK_REJECTION_STATUS = {
  /** The document is not a workbook this module can safely read. */
  invalid_snapshot: 400,
  /** Well formed, but bigger than one job is allowed to be. Split it, don't fix it. */
  too_large: 413,
  /** A formula whose dependency or safety contract cannot be validated. */
  unsupported_formula: 422,
  /** The engine's own dependency graph contains a cycle. Results are not published. */
  cyclic_formula: 422,
  /** The bounded queue is full. Retry; nothing was calculated. */
  busy: 429,
  /** The worker passed its deadline and was terminated. */
  timeout: 504,
  /** The caller went away. Conventional "client closed request"; usually nobody is listening. */
  aborted: 499,
  /** The worker died, or answered something this module cannot read. */
  engine_failure: 500,
} as const satisfies Record<string, number>;

export type WorkbookRejectionReason = keyof typeof WORKBOOK_REJECTION_STATUS;

export interface WorkbookRejectionOptions {
  /** Engine-graph cycle paths, when the reason is `cyclic_formula`. */
  readonly cycles?: readonly string[];
  /** Where in the document the refusal was raised, e.g. `s1!r0c1`. */
  readonly at?: string;
}

export class WorkbookRejectedError extends AppError {
  readonly reason: WorkbookRejectionReason;
  readonly cycles: readonly string[];
  readonly at: string | null;

  constructor(reason: WorkbookRejectionReason, message: string, options: WorkbookRejectionOptions = {}) {
    const cycles = options.cycles ?? [];
    const at = options.at ?? null;
    super(message, {
      statusCode: WORKBOOK_REJECTION_STATUS[reason],
      code: `workbook_${reason}`,
      details: cycles.length > 0 || at !== null ? { at, cycles } : undefined,
    });
    this.reason = reason;
    this.cycles = cycles;
    this.at = at;
  }
}

/**
 * Refuse the calculation. Returns `never` so a validator can `rejectWorkbook(...)`
 * in a branch without the compiler losing the narrowing that follows it.
 */
export function rejectWorkbook(
  reason: WorkbookRejectionReason,
  message: string,
  options: WorkbookRejectionOptions = {},
): never {
  throw new WorkbookRejectedError(reason, message, options);
}

export function isWorkbookRejection(error: unknown, reason?: WorkbookRejectionReason): error is WorkbookRejectedError {
  return error instanceof WorkbookRejectedError && (reason === undefined || error.reason === reason);
}

/**
 * The serialisable half of a rejection, so a worker can post one back across a
 * thread boundary and the parent can rebuild it without losing the reason.
 */
export interface WorkbookRejectionWire {
  readonly reason: WorkbookRejectionReason;
  readonly message: string;
  readonly cycles: readonly string[];
  readonly at: string | null;
}

export function toRejectionWire(error: unknown): WorkbookRejectionWire {
  if (isWorkbookRejection(error)) {
    return { reason: error.reason, message: error.message, cycles: error.cycles, at: error.at };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { reason: "engine_failure", message, cycles: [], at: null };
}

export function fromRejectionWire(wire: WorkbookRejectionWire): WorkbookRejectedError {
  return new WorkbookRejectedError(wire.reason, wire.message, { cycles: wire.cycles, at: wire.at ?? undefined });
}
