// The two tokens that pin an apply to the preview the user actually read.
//
// Both are SHA256 over canonical JSON — keys sorted, numbers normalised — the
// same encoding the editor's operation fingerprints use, so 2.70 and 2.7 agree
// and a reordered response body cannot look like a change.
//
// What goes in matters more than the hash. Each token covers every field the
// preview REST on, not a convenient subset: if a change could alter what the
// user was shown, it must alter the token. The estimate's token in particular
// covers its complete editable state rather than `updated_at`, because
// recalcTotals rewrites the totals without touching that column — a timestamp
// check would wave through an estimate whose figures had all moved.

import { createHash } from "node:crypto";
import type { Estimate, EstimateItem } from "../../proposals/types.ts";
import { canonicalJson } from "./editor-fingerprint.ts";
import type { PreconBoqRowDto } from "./row-types.ts";
import type { PreconBill, PreconSummarySettings } from "./session-types.ts";
import type { ApplySourceState, ApplyReviewState, ApplyTargetState, ExpectedRow } from "./apply-to-estimate-types.ts";

function sha256(material: unknown): string {
  return createHash("sha256").update(canonicalJson(material), "utf8").digest("hex");
}

const byId = <T extends { id: string }>(rows: T[]): T[] => [...rows].sort((a, b) => a.id.localeCompare(b.id));

/**
 * The active take-off set behind a preview: every row's identity and version,
 * plus the fields the diff reads, plus the bills and settings that name and
 * group them.
 */
export function sourceFingerprint(
  sessionId: string,
  bills: PreconBill[],
  rows: PreconBoqRowDto[],
  settings: PreconSummarySettings,
): string {
  return sha256({
    sessionId,
    bills: byId(bills).map((b) => ({ id: b.id, title: b.title, sort: b.sort })),
    settings: {
      prelimsPct: settings.prelimsPct,
      contingencyPct: settings.contingencyPct,
      vatPct: settings.vatPct,
    },
    rows: byId(rows).map((r) => ({
      id: r.id,
      version: r.version,
      billId: r.billId,
      sort: r.sort,
      rowType: r.rowType,
      status: r.status,
      elementGroup: r.elementGroup,
      description: r.description,
      unit: r.unit,
      qty: r.qty,
      rate: r.rate,
    })),
  });
}

/** The estimate's complete editable state — never its `updatedAt`. */
export function targetFingerprint(estimate: Estimate, items: EstimateItem[]): string {
  return sha256({
    estimateId: estimate.id,
    status: estimate.status,
    contingencyPct: estimate.contingencyPct,
    taxPct: estimate.taxPct,
    taxLabel: estimate.taxLabel,
    items: byId(items).map((i) => ({
      id: i.id,
      groupLabel: i.groupLabel,
      description: i.description,
      descriptionHtml: i.descriptionHtml ?? null,
      qty: i.qty,
      unit: i.unit,
      unitRate: i.unitRate,
      boqItemId: i.boqItemId,
      takeoffSessionId: i.takeoffSessionId,
      sort: i.sort,
    })),
  });
}

export function sourceState(
  sessionId: string,
  bills: PreconBill[],
  rows: PreconBoqRowDto[],
  settings: PreconSummarySettings,
  consumed: PreconBoqRowDto[],
): ApplySourceState {
  return {
    sessionId,
    fingerprint: sourceFingerprint(sessionId, bills, rows, settings),
    expectedRows: byId(consumed).map((r): ExpectedRow => ({ id: r.id, version: r.version })),
    rowCount: rows.length,
  };
}

export function targetState(estimate: Estimate, items: EstimateItem[]): ApplyTargetState {
  return {
    estimateId: estimate.id,
    fingerprint: targetFingerprint(estimate, items),
    status: estimate.status,
    itemCount: items.length,
  };
}

// A row with no status at all is an old record nobody has signed off, so it
// counts as unverified rather than being quietly waved through.
export function reviewState(consumed: PreconBoqRowDto[]): ApplyReviewState {
  const count = (status: string): number => consumed.filter((r) => r.status === status).length;
  return {
    verified: count("verified"),
    needsReview: count("needs_review"),
    aiGenerated: count("ai_generated"),
    unverifiedRowIds: byId(consumed)
      .filter((r) => r.status !== "verified")
      .map((r) => r.id),
  };
}

export function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, i) => id === right[i]);
}
