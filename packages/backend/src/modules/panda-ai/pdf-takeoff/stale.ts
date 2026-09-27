import type { PreconSession, PreconSessionStale } from "./types.ts";

/**
 * Newest superseding plan per plan id, for a batch of plan ids in one query;
 * a plan that is still current is absent from the map.
 */
export type StaleLookup = (planIds: string[]) => Promise<Map<string, PreconSessionStale>>;

export const noStaleLookup: StaleLookup = async () => new Map();

/** The production lookup: the proposals module's plan supersession chain. */
export const staleLookupFromPlans = (plans: { newestSupersedingPlans: StaleLookup }): StaleLookup => (planIds) => plans.newestSupersedingPlans(planIds);

/**
 * A take-off is stale when the drawing it measured has been superseded: the
 * bill still stands as a record of what was measured on that revision, but
 * the estimator should re-measure on the newest one. Resolved for a whole
 * list at once so the sessions list never asks per row.
 */
export async function withStale<T extends PreconSession>(sessions: T[], lookup: StaleLookup): Promise<(T & { stale: PreconSessionStale | null })[]> {
  const planIds = [...new Set(sessions.map((s) => s.planId).filter((id): id is string => Boolean(id)))];
  const newer = planIds.length ? await lookup(planIds) : new Map<string, PreconSessionStale>();
  return sessions.map((s) => ({ ...s, stale: (s.planId && newer.get(s.planId)) || null }));
}
