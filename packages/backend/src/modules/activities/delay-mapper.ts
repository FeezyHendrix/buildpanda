import { toIso, toIsoOrNull } from "../../lib/dates.ts";
import type { ActivityDelay, ActivityDelayRow, DelayReasonRow } from "./types.ts";

/** Row → DTO for a delay. Shared by the activity reader and the delay service. */
export function buildDelay(
  row: ActivityDelayRow,
  reason: DelayReasonRow | undefined,
): ActivityDelay {
  return {
    id: row.id,
    activityId: row.activity_id,
    reasonCode: row.reason_code,
    reasonName: reason?.name ?? row.reason_code,
    reasonCategory: reason?.category ?? "Other",
    description: row.description,
    descriptionHtml: row.description_html,
    startedAt: toIso(row.started_at),
    endedAt: toIsoOrNull(row.ended_at),
    daysLost: Number(row.days_lost ?? 0),
    culpability: row.culpability ?? "neutral",
    eotClaimable: Boolean(row.eot_claimable),
    linkedRfiId: row.linked_rfi_id ?? null,
    linkedChangeRequestId: row.linked_change_request_id ?? null,
    linkedMaterialOrderId: row.linked_material_order_id ?? null,
    appliedShiftDays: Number(row.applied_shift_days ?? 0),
    resolvedAt: toIsoOrNull(row.resolved_at),
    resolvedById: row.resolved_by_id ?? null,
    costImpact: Number(row.cost_impact),
    currency: row.currency,
    preventionNotes: row.prevention_notes,
    recordedBy: row.recorded_by_id ? { id: row.recorded_by_id, name: null } : null,
    createdAt: toIso(row.created_at),
  };
}
