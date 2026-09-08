import type { PreconSession } from "@/api/precon";
import { describeScope } from "@/lib/precon-meta";

/**
 * A take-off is one drawing measured for one scope. Measuring it again makes
 * a new revision of the same take-off; earlier revisions are kept but sit
 * behind the current one. Hand-built take-offs (no drawing) stand alone.
 */
export interface TakeoffGroup {
  key: string;
  current: PreconSession;
  earlier: PreconSession[];
}

function keyFor(session: PreconSession): string {
  return session.planId ? `${session.planId}:${describeScope(session.scope)}` : session.id;
}

export function groupTakeoffs(sessions: PreconSession[]): TakeoffGroup[] {
  const byKey = new Map<string, PreconSession[]>();
  for (const s of sessions) {
    const key = keyFor(s);
    byKey.set(key, [...(byKey.get(key) ?? []), s]);
  }
  const groups: TakeoffGroup[] = [];
  for (const [key, members] of byKey) {
    const sorted = [...members].sort((a, b) => b.revision - a.revision || b.createdAt.localeCompare(a.createdAt));
    const current = sorted.find((s) => s.supersededBy === null) ?? sorted[0]!;
    groups.push({ key, current, earlier: sorted.filter((s) => s.id !== current.id) });
  }
  // newest activity first
  return groups.sort((a, b) => b.current.createdAt.localeCompare(a.current.createdAt));
}

/** The take-off to open by default: the current revision most in need of a reviewer. */
export function defaultTakeoff(groups: TakeoffGroup[]): PreconSession | null {
  return groups.find((g) => g.current.status === "reviewing")?.current ?? groups[0]?.current ?? null;
}
