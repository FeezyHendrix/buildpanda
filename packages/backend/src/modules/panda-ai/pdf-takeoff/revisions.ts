import type { PreconRepository } from "./repository.ts";
import type { TakeoffKind, TakeoffScope } from "./types.ts";

function sameScope(a: TakeoffScope | null, b: TakeoffScope): boolean {
  if (!a) return false;
  return a.kind === b.kind && [...a.elements].sort().join(",") === [...b.elements].sort().join(",");
}

// A take-off measured by hand and one measured by the engine are different
// records of the same drawing: each keeps its own revision numbering, and
// neither supersedes the other.
export type LineageKind = "ai" | "manual";

export const lineageKindOf = (kind: TakeoffKind | null | undefined): LineageKind => (kind === "manual" ? "manual" : "ai");

/**
 * Measuring a drawing again with the same scope is a new revision of the same
 * take-off: the new session takes the next number and every live sibling is
 * marked superseded by it. Earlier revisions stay readable for the audit trail.
 * The lineage key is plan + scope + kind (manual or AI).
 */
export async function nextRevision(
  repo: PreconRepository,
  planId: string | null,
  scope: TakeoffScope,
  kind: LineageKind = "ai",
): Promise<{ revision: number; supersedes: string[] }> {
  if (!planId) return { revision: 1, supersedes: [] };
  const siblings = (await repo.sessionsByPlan(planId)).filter(
    (s) => sameScope(s.scope, scope) && lineageKindOf(s.takeoff_kind) === kind,
  );
  const revision = siblings.reduce((max, s) => Math.max(max, s.revision ?? 1), 0) + 1;
  return { revision, supersedes: siblings.filter((s) => s.superseded_by === null).map((s) => s.id) };
}
