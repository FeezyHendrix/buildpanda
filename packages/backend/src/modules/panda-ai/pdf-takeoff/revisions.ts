import type { PreconRepository } from "./repository.ts";
import type { TakeoffScope } from "./types.ts";

function sameScope(a: TakeoffScope | null, b: TakeoffScope): boolean {
  if (!a) return false;
  return a.kind === b.kind && [...a.elements].sort().join(",") === [...b.elements].sort().join(",");
}

/**
 * Measuring a drawing again with the same scope is a new revision of the same
 * take-off: the new session takes the next number and every live sibling is
 * marked superseded by it. Earlier revisions stay readable for the audit trail.
 */
export async function nextRevision(repo: PreconRepository, planId: string | null, scope: TakeoffScope): Promise<{ revision: number; supersedes: string[] }> {
  if (!planId) return { revision: 1, supersedes: [] };
  const siblings = (await repo.sessionsByPlan(planId)).filter((s) => sameScope(s.scope, scope));
  const revision = siblings.reduce((max, s) => Math.max(max, s.revision ?? 1), 0) + 1;
  return { revision, supersedes: siblings.filter((s) => s.superseded_by === null).map((s) => s.id) };
}
