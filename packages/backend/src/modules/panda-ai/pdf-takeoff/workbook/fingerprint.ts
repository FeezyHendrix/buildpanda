// Two hashes, answering two different questions.
//
// `sourceFingerprint` answers "are the figures this workbook was calculated
// against still the figures on the bill?". It is what a save sends back, and
// what a commit re-checks after the worker has run — so a remeasure that landed
// mid-calculation cannot be overwritten by results computed before it.
//
// `saveFingerprint` answers "is this the same request I already recorded?". It
// is what makes a retried save idempotent instead of a second edit.
//
// Both hash canonical JSON — keys sorted, numbers normalised — reusing the
// editor's encoder so `2.70` and `2.7` agree here exactly as they do there.
//
// What goes into the source hash is the whole argument. It covers every value a
// formula could depend on, and every VERSION behind those values, and it covers
// withdrawn lines too: a line disappearing changes what the workbook shows just
// as much as a quantity changing, and a fingerprint blind to it would let a
// stale document commit over a withdrawal.

import { createHash } from "node:crypto";
import { canonicalJson } from "../editor-fingerprint.ts";
import { num } from "../dto.ts";
import type { WorkbookSourceSet } from "./source.ts";
import type { WorkbookSaveRequest, WorkbookReverseRequest } from "./types.ts";
import type { WorkbookSnapshot } from "./engine-types.ts";

const sha256 = (material: unknown): string => createHash("sha256").update(canonicalJson(material), "utf8").digest("hex");

const byId = <T extends { id: string }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => a.id.localeCompare(b.id));

export function sourceFingerprint(source: WorkbookSourceSet): string {
  return sha256({
    sessionId: source.sessionId,
    revision: source.revision,
    bills: byId(source.bills).map((bill) => ({ id: bill.id, title: bill.title, sort: bill.sort })),
    rows: byId(source.rows).map((row) => ({
      id: row.id,
      version: row.version,
      billId: row.bill_id,
      sort: row.sort,
      rowType: row.row_type,
      status: row.status,
      code: row.code,
      description: row.description,
      unit: row.unit,
      qty: num(row.qty),
      rate: num(row.rate),
      amount: num(row.amount),
      measurementBasis: row.measurement_basis,
      withdrawn: row.deleted_at != null,
    })),
    // A figure's evidence is a dependency of the figure: withdrawing the last
    // annotation behind a line changes what a Remeasure can offer, even when
    // the quantity itself has not moved yet.
    geometries: byId(source.geometries).map((geometry) => ({
      id: geometry.id,
      rowId: geometry.row_id,
      sheetId: geometry.sheet_id,
      kind: geometry.kind,
      quantity: num(geometry.quantity),
      unit: geometry.unit,
      hasDefinition: geometry.definition != null,
    })),
    // The scale a drawing is measured at: re-calibrating restates every line on
    // it, so the workbook's figures are downstream of this too.
    sheets: byId(source.sheets).map((sheet) => ({
      id: sheet.id,
      version: sheet.version ?? 1,
      scaleMmPerPt: sheet.scale_mm_per_pt,
    })),
  });
}

/**
 * What a save MEANS: the document, the patches and the two states it claimed to
 * be starting from. `operationId` is excluded — it is the identity the record is
 * looked up by, not part of what is being compared.
 */
export function saveFingerprint(request: WorkbookSaveRequest, snapshot: WorkbookSnapshot): string {
  return sha256({
    expectedVersion: request.expectedVersion,
    expectedSourceFingerprint: request.expectedSourceFingerprint,
    snapshot,
    rowPatches: [...(request.rowPatches ?? [])]
      .map((patch) => ({
        rowId: patch.rowId,
        version: patch.version,
        description: patch.description ?? null,
        rate: patch.rate ?? null,
      }))
      .sort((a, b) => a.rowId.localeCompare(b.rowId)),
  });
}

/** The same identity for an undo: the entry it compensates for, and the state it expected. */
export function reverseFingerprint(eventId: string, request: WorkbookReverseRequest): string {
  return sha256({
    reverses: eventId,
    expectedVersion: request.expectedVersion,
    expectedSourceFingerprint: request.expectedSourceFingerprint,
  });
}
