import type { PreconSession, PreconSheet } from "@/api/precon";
import type { ProposalPlan } from "@/api/proposals";

// Pure lookups along the drawing revision chain, kept free of React and the
// axios client so they can be unit-tested in node.

/** The take-off measured on the plan this session's plan supersedes: same kind first, latest revision. */
export function previousSessionFor(session: PreconSession, plans: ProposalPlan[], sessions: PreconSession[]): { session: PreconSession; plan: ProposalPlan } | null {
  const plan = plans.find((p) => p.id === session.planId);
  const previousPlan = plan?.supersedesPlanId ? plans.find((p) => p.id === plan.supersedesPlanId) : null;
  if (!previousPlan) return null;
  const candidates = sessions.filter((s) => s.planId === previousPlan.id && s.id !== session.id);
  const sameKind = candidates.filter((s) => s.takeoffKind === session.takeoffKind);
  const pool = sameKind.length > 0 ? sameKind : candidates;
  let best: PreconSession | null = null;
  for (const s of pool) if (!best || s.revision > best.revision) best = s;
  return best ? { session: best, plan: previousPlan } : null;
}

/** The previous take-off's sheet that matches this one: by sheet code, else by page number. */
export function matchingSheet(sheet: PreconSheet, previousSheets: PreconSheet[]): PreconSheet | null {
  return previousSheets.find((s) => sheet.code && s.code === sheet.code) ?? previousSheets.find((s) => s.pageNumber === sheet.pageNumber) ?? null;
}
