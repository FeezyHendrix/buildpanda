import { toIsoOrNull } from "../../lib/dates.ts";
import { generateId } from "../../lib/ids.ts";
import type { ActivitiesRepository, ActivityUpdatePatch } from "./repository.ts";
import type { ActivityRow, UpdateActivityInput } from "./types.ts";

/**
 * A programme change can be a claim, so moving a bar has two rules the page
 * only mirrors: the first move pins the baseline for good, and every move is
 * written down with its size and who made it.
 */
export function plannedDatesMove(existing: ActivityRow, input: UpdateActivityInput): boolean {
  return (
    (input.plannedStartAt !== undefined && input.plannedStartAt !== toIsoOrNull(existing.planned_start_at)) ||
    (input.plannedEndAt !== undefined && input.plannedEndAt !== toIsoOrNull(existing.planned_end_at))
  );
}

/** The baseline, if this move is the first one; never overwrites an existing baseline. */
export function baselineOnFirstMove(existing: ActivityRow): Pick<ActivityUpdatePatch, "baseline_start_at" | "baseline_end_at"> {
  if (existing.baseline_start_at || existing.baseline_end_at) return {};
  return { baseline_start_at: toIsoOrNull(existing.planned_start_at), baseline_end_at: toIsoOrNull(existing.planned_end_at) };
}

export async function recordProgrammeEdit(
  repository: Pick<ActivitiesRepository, "recordEvent">,
  projectId: string,
  before: ActivityRow,
  after: ActivityRow,
  actorId: string | null,
): Promise<void> {
  const endBefore = toIsoOrNull(before.planned_end_at);
  const endAfter = toIsoOrNull(after.planned_end_at);
  const daysDelta = endBefore && endAfter ? Math.round((Date.parse(endAfter) - Date.parse(endBefore)) / 86_400_000) : 0;
  await repository.recordEvent({
    id: generateId("aev"),
    project_id: projectId,
    activity_id: after.id,
    kind: "programme_edit",
    summary: `Planned dates moved to ${toIsoOrNull(after.planned_start_at)?.slice(0, 10)} – ${endAfter?.slice(0, 10)}`,
    days_delta: daysDelta,
    delay_id: null,
    actor_id: actorId,
  });
}
