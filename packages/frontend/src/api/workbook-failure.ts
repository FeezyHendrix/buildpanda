// Classifying a failed workbook save.
//
// Deliberately free of the axios CLIENT — only its error type — so the rules
// below run under the plain node test runner. `workbook.ts` imports the client
// and cannot, and these are the rules a user's error message depends on.

import { AxiosError } from "axios";

// ------------------------------------------------------------------ refusals

export type WorkbookFailureKind =
  /** 409. Reload, compare, reapply. The draft survives. */
  | "stale"
  /** 422 `workbook_protected`. Nothing was saved; the paste touched a measured figure. */
  | "protected"
  /** 422/400 from the calculator: a cycle, a bad formula, a document over bounds. */
  | "rejected"
  /** 429. The calculator queue is full. The same operationId may be retried. */
  | "busy"
  /** Network, timeout, 5xx. Retry with the SAME operationId — it may already have landed. */
  | "unreachable"
  | "forbidden";

export interface WorkbookFailure {
  readonly kind: WorkbookFailureKind;
  readonly message: string;
  /** Server error code, e.g. `workbook_protected`, `workbook_cyclic_formula`. */
  readonly code: string | null;
  /** For a protected refusal: which cell, in the server's own words. */
  readonly at: string | null;
  /** Whether resending the identical candidate could ever succeed. */
  readonly retryable: boolean;
}

interface ServerError {
  error?: unknown;
  code?: unknown;
  details?: { at?: unknown; reason?: unknown };
}

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const KIND_BY_CODE: Readonly<Record<string, WorkbookFailureKind>> = {
  workbook_protected: "protected",
  workbook_cyclic_formula: "rejected",
  workbook_rejected: "rejected",
};

function kindFor(status: number, code: string | null): WorkbookFailureKind {
  if (code && KIND_BY_CODE[code]) return KIND_BY_CODE[code]!;
  if (status === 409) return "stale";
  if (status === 429) return "busy";
  if (status === 403 || status === 404) return "forbidden";
  if (status === 422 || status === 400 || status === 413) return "rejected";
  return "unreachable";
}

/**
 * What to say when the server said nothing usable. A dropped request leaves
 * axios's own "Network Error", which names no subject and offers no next step;
 * these do both, and the server's own wording still wins whenever there is any.
 */
const MESSAGE_BY_KIND: Readonly<Record<WorkbookFailureKind, string>> = {
  unreachable: "The workbook could not be saved — BuildPanda could not be reached.",
  busy: "The take-off calculator is busy right now, so the workbook was not saved.",
  stale: "This workbook was saved by someone else while you were working.",
  protected: "That change was refused because it would alter measured take-off data. Nothing was saved.",
  rejected: "The workbook was refused by the take-off calculator, so nothing was saved.",
  forbidden: "You do not have permission to save this workbook.",
};

/**
 * Classify a failed save. `unreachable` and `busy` are the only kinds where
 * resending the SAME candidate under the SAME operationId is correct: the
 * server's exactly-once index will answer with the original receipt if the
 * first attempt actually landed.
 */
export function classifyWorkbookFailure(error: unknown): WorkbookFailure {
  if (!(error instanceof AxiosError)) {
    return { kind: "unreachable", message: MESSAGE_BY_KIND.unreachable, code: null, at: null, retryable: true };
  }
  const status = error.response?.status ?? 0;
  const body = (error.response?.data ?? {}) as ServerError;
  const code = asString(body.code);
  const kind = kindFor(status, code);
  return {
    kind,
    message: asString(body.error) ?? MESSAGE_BY_KIND[kind],
    code,
    at: asString(body.details?.at),
    retryable: kind === "unreachable" || kind === "busy",
  };
}
