// Turning sources plus a user document into the one answer the API returns.
//
// Every read runs this, and every read therefore RECALCULATES. There is no path
// that serves a figure out of storage: the stored fingerprint is compared and
// reported (`sourcesMoved`), never trusted to authorise a cached value. That is
// the whole of contract 6's "never stale cache", enforced by not having a cache
// to be wrong about.
//
// The patch projection here is not a second implementation of the row policy —
// it calls `buildRowUpdatePatch`, the same function the transactional write
// calls. So what the worker calculates and what the database ends up holding
// cannot disagree about what a rate change did.

import { ConflictError, NotFoundError } from "../../../../lib/errors.ts";
import { buildRowUpdatePatch } from "../row-patch.ts";
import { evaluateWorkbook } from "./engine.ts";
import { hydrateWorkbook } from "./hydrate.ts";
import { buildGeneratedLayout, withScratchSheets, workbookIdFor, WORKBOOK_ENGINE_VERSION } from "./layout.ts";
import { sourceFingerprint } from "./fingerprint.ts";
import type { WorkbookSourceSet } from "./source.ts";
import type { EvaluateWorkbookResult, WorkbookSnapshot } from "./engine-types.ts";
import type {
  PreconWorkbookRow,
  WorkbookDocument,
  WorkbookHistoryEntry,
  WorkbookLayout,
  WorkbookReviewRollup,
  WorkbookRowPatch,
} from "./types.ts";
import type { PreconBoqRowRow } from "../types.ts";

export function liveRowsById(source: WorkbookSourceSet): Map<string, PreconBoqRowRow> {
  return new Map(source.rows.filter((row) => row.deleted_at == null).map((row) => [row.id, row]));
}

const PRICED_ROW_TYPES = new Set(["item", "provisional_sum"]);

/**
 * The bill lines as this save will leave them, computed before the worker runs
 * so the figures it calculates are the figures that get committed. The version
 * check here is an early refusal; the authoritative one happens under the lock.
 */
export function projectPatchedRows(
  rows: ReadonlyMap<string, PreconBoqRowRow>,
  patches: readonly WorkbookRowPatch[],
  actor: string,
): Map<string, PreconBoqRowRow> {
  const projected = new Map(rows);
  for (const patch of patches) {
    const row = rows.get(patch.rowId);
    if (!row) throw new NotFoundError("BOQ row");
    if (row.version !== patch.version) {
      throw new ConflictError(
        `That bill line was updated by someone else (current version ${row.version}); refresh and reapply`,
      );
    }
    if (patch.rate !== undefined && !PRICED_ROW_TYPES.has(row.row_type)) {
      throw new ConflictError("Only priced bill lines carry a rate");
    }
    const { patch: applied } = buildRowUpdatePatch(
      row,
      {
        ...(patch.description === undefined ? {} : { description: patch.description }),
        ...(patch.rate === undefined ? {} : { rate: patch.rate }),
      },
      actor,
    );
    projected.set(patch.rowId, { ...row, ...applied } as PreconBoqRowRow);
  }
  return projected;
}

export function reviewRollup(
  layout: WorkbookLayout,
  rows: ReadonlyMap<string, PreconBoqRowRow>,
  sourcesMoved: boolean,
): WorkbookReviewRollup {
  let boundRows = 0;
  let verified = 0;
  let needsReview = 0;
  let unreviewed = 0;
  let withdrawn = 0;
  let missingBasis = 0;
  let stated = 0;

  for (const sheet of layout.sheets) {
    for (const binding of sheet.bindings) {
      if (binding.state === "withdrawn") {
        withdrawn += 1;
        continue;
      }
      if (binding.basis === "narrative") continue;
      boundRows += 1;
      if (binding.basis === "legacy") missingBasis += 1;
      if (binding.basis === "stated") stated += 1;
      const status = rows.get(binding.rowId)?.status ?? null;
      if (status === "verified") verified += 1;
      else if (status === "needs_review") needsReview += 1;
      else unreviewed += 1;
    }
  }
  return { boundRows, verified, needsReview, unreviewed, withdrawn, missingBasis, stated, sourcesMoved };
}

export interface DocumentParts {
  readonly sessionId: string;
  readonly version: number;
  readonly snapshot: WorkbookSnapshot;
  readonly layout: WorkbookLayout;
  readonly values: EvaluateWorkbookResult["values"];
  readonly errors: EvaluateWorkbookResult["errors"];
  readonly sourceFingerprint: string;
  readonly rows: ReadonlyMap<string, PreconBoqRowRow>;
  readonly sourcesMoved: boolean;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
  readonly history: readonly WorkbookHistoryEntry[];
}

export function documentOf(parts: DocumentParts): WorkbookDocument {
  return {
    sessionId: parts.sessionId,
    version: parts.version,
    engineVersion: WORKBOOK_ENGINE_VERSION,
    snapshot: parts.snapshot,
    layout: parts.layout,
    values: parts.values,
    errors: parts.errors,
    sourceFingerprint: parts.sourceFingerprint,
    reviewRollup: reviewRollup(parts.layout, parts.rows, parts.sourcesMoved),
    updatedAt: parts.updatedAt,
    updatedBy: parts.updatedBy,
    history: parts.history,
  };
}

export interface ComposeInput {
  readonly source: WorkbookSourceSet;
  readonly stored: PreconWorkbookRow | undefined;
  /** The user's document, sanitized. `null` builds the deterministic first draft. */
  readonly user: WorkbookSnapshot | null;
  readonly rows: ReadonlyMap<string, PreconBoqRowRow>;
  readonly version: number;
  readonly history: readonly WorkbookHistoryEntry[];
  readonly signal?: AbortSignal;
  readonly jobId?: string;
}

export interface ComposedWorkbook {
  readonly document: WorkbookDocument;
  readonly layout: WorkbookLayout;
  readonly snapshot: WorkbookSnapshot;
  readonly sourceFingerprint: string;
}

/**
 * Build the layout, render the bill into it, calculate the result and hand back
 * one coherent document.
 *
 * The calculation happens here and therefore outside any lock — this function
 * takes no transaction and opens none, which is what makes "no worker runs
 * while a row is held" true by construction rather than by discipline.
 */
export async function composeWorkbook({
  source,
  stored,
  user,
  rows,
  version,
  history,
  signal,
  jobId,
}: ComposeInput): Promise<ComposedWorkbook> {
  const generated = buildGeneratedLayout(source, stored?.layout);
  const carried = user ?? stored?.snapshot ?? null;
  const order = carried ? carried.sheetOrder : generated.map((sheet) => sheet.sheetId);
  const layout = withScratchSheets(
    generated,
    order,
    (sheetId) => carried?.sheets[sheetId]?.name ?? sheetId,
  );

  const snapshot = hydrateWorkbook({
    workbookId: workbookIdFor(source.sessionId),
    workbookName: carried?.name ?? "Takeoff workbook",
    layout,
    rows,
    user: carried,
  });

  const evaluated = await evaluateWorkbook(snapshot, {
    ...(signal ? { signal } : {}),
    ...(jobId ? { jobId } : {}),
  });

  const fingerprint = sourceFingerprint(source);
  const document = documentOf({
    sessionId: source.sessionId,
    version,
    snapshot: evaluated.snapshot,
    layout,
    values: evaluated.values,
    errors: evaluated.errors,
    sourceFingerprint: fingerprint,
    rows,
    sourcesMoved: stored !== undefined && stored.source_fingerprint !== fingerprint,
    updatedAt: stored ? new Date(stored.updated_at).toISOString() : null,
    updatedBy: stored?.updated_by ?? null,
    history,
  });

  return { document, layout, snapshot: evaluated.snapshot, sourceFingerprint: fingerprint };
}
