import type { PreconSheet } from "@/api/precon";
import { usePreconSessionsFor, usePreconSnapshot } from "@/hooks/use-precon";
import { useProposalPlans } from "@/hooks/use-proposals";
import { matchingSheet, previousSessionFor } from "./revision-chain";

export interface PreviousRevision {
  /** "loading" while the chain is still being fetched; "none" when the drawing has no earlier revision measured. */
  status: "loading" | "none" | "ready";
  sheet: PreconSheet | null;
  /** Every sheet of the previous take-off (a PDF page is found within its own file). */
  sheets: PreconSheet[];
  /** The previous drawing's revision label, if any. */
  revision: string | null;
}

const NONE: PreviousRevision = { status: "none", sheet: null, sheets: [], revision: null };
const LOADING: PreviousRevision = { ...NONE, status: "loading" };

/**
 * Resolves the sheet to overlay under the active one: the session's plan →
 * the plan it supersedes → the take-off measured on that plan → its sheet
 * with the same code. Fetches only while the overlay is wanted.
 */
export function usePreviousRevision(sessionId: string, activeSheet: PreconSheet | null, enabled: boolean): PreviousRevision {
  const { data: snapshot } = usePreconSnapshot(sessionId);
  const session = snapshot?.session ?? null;
  const proposalId = enabled ? (session?.proposalId ?? null) : null;
  const plans = useProposalPlans(proposalId ?? "");
  const sessions = usePreconSessionsFor(proposalId);
  const previous = session && plans.data && sessions.data ? previousSessionFor(session, plans.data, sessions.data) : null;
  const previousSnapshot = usePreconSnapshot(enabled && previous ? previous.session.id : "");

  if (!enabled || !activeSheet) return NONE;
  if (!session) return LOADING;
  if (!session.planId || !session.proposalId) return NONE;
  if (plans.isPending || sessions.isPending) return LOADING;
  if (!previous) return NONE;
  if (previousSnapshot.isPending) return LOADING;
  const sheets = previousSnapshot.data?.sheets ?? [];
  const sheet = matchingSheet(activeSheet, sheets);
  return sheet ? { status: "ready", sheet, sheets, revision: previous.plan.revision } : NONE;
}
