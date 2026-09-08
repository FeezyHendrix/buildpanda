import type { CreateEstimateItemInput, EstimateItem } from "../../proposals/types.ts";
import type { ApplyPreview, ApplyPreviewItem, PreconBill, PreconBoqRowDto } from "./types.ts";

// Estimate items reference the take-off line that produced them (boqItemId =
// precon_boq_rows.id). Quantity flows through that link; the rate belongs to
// the estimate, so a re-apply keeps a rate the estimator already entered.

const PRICED_ROW_TYPES = new Set(["item", "provisional_sum"]);

type Candidate = Omit<ApplyPreviewItem, "change" | "previous">;

function candidateItems(sessionId: string, bills: PreconBill[], rows: PreconBoqRowDto[]): Candidate[] {
  const billTitle = new Map(bills.map((b) => [b.id, b.title]));
  return rows
    .filter((r) => PRICED_ROW_TYPES.has(r.rowType) && r.status !== "rejected")
    .map((r) => ({
      groupLabel: r.elementGroup ?? billTitle.get(r.billId) ?? "General",
      description: r.description,
      qty: r.qty ?? 0,
      unit: r.unit ?? "item",
      unitRate: r.rate ?? 0,
      boqItemId: r.id,
      takeoffSessionId: sessionId,
    }));
}

/**
 * Diff the take-off against the estimate's current items. Items linked to this
 * session are replaced by the take-off's lines (added / changed / removed);
 * hand-entered items and items linked to other take-offs are kept as they are.
 */
export function diffTakeoffAgainstEstimate(
  sessionId: string,
  bills: PreconBill[],
  rows: PreconBoqRowDto[],
  existing: EstimateItem[],
): ApplyPreview {
  const candidates = candidateItems(sessionId, bills, rows);
  const existingByLine = new Map(existing.filter((i) => i.boqItemId).map((i) => [i.boqItemId as string, i]));
  const items: ApplyPreviewItem[] = [];

  for (const candidate of candidates) {
    const previous = candidate.boqItemId ? existingByLine.get(candidate.boqItemId) : undefined;
    if (!previous) {
      items.push({ ...candidate, change: "added" });
      continue;
    }
    const unitRate = candidate.unitRate > 0 ? candidate.unitRate : previous.unitRate;
    const same =
      previous.qty === candidate.qty && previous.unit === candidate.unit && previous.description === candidate.description;
    items.push({
      ...candidate,
      unitRate,
      groupLabel: previous.groupLabel || candidate.groupLabel,
      change: same ? "unchanged" : "changed",
      previous: same ? undefined : { qty: previous.qty, unit: previous.unit, description: previous.description },
    });
  }

  const candidateLineIds = new Set(candidates.map((c) => c.boqItemId));
  for (const item of existing) {
    const fromThisSession = item.takeoffSessionId === sessionId || (item.boqItemId && rows.some((r) => r.id === item.boqItemId));
    if (fromThisSession && item.boqItemId && !candidateLineIds.has(item.boqItemId)) {
      items.push({
        groupLabel: item.groupLabel,
        description: item.description,
        qty: item.qty,
        unit: item.unit,
        unitRate: item.unitRate,
        boqItemId: item.boqItemId,
        takeoffSessionId: item.takeoffSessionId,
        change: "removed",
      });
    } else if (!fromThisSession) {
      items.push({
        groupLabel: item.groupLabel,
        description: item.description,
        descriptionHtml: item.descriptionHtml,
        qty: item.qty,
        unit: item.unit,
        unitRate: item.unitRate,
        boqItemId: item.boqItemId,
        takeoffSessionId: item.takeoffSessionId,
        change: "unchanged",
      });
    }
  }

  const count = (change: ApplyPreviewItem["change"]) => items.filter((i) => i.change === change).length;
  return { added: count("added"), changed: count("changed"), removed: count("removed"), unchanged: count("unchanged"), items };
}

/** The item list to write: everything in the preview except removed lines, re-sorted. */
export function itemsToWrite(preview: ApplyPreview): CreateEstimateItemInput[] {
  return preview.items
    .filter((i) => i.change !== "removed")
    .map(({ change: _change, previous: _previous, ...item }, index) => ({ ...item, sort: index }));
}
