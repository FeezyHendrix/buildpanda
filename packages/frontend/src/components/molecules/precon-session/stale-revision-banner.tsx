import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { MeasurePlanDialog } from "@/components/molecules/proposal-plans/measure-plan-dialog";
import type { PreconSession, TakeoffScope } from "@/api/precon";
import { useCreatePreconSessionFromPlan, useCreatePreconSessionFromPlanWithMode, usePreconSessions } from "@/hooks/use-precon";
import { useProposalPlans, useProposalWorkspace, useStartProposalTakeoff } from "@/hooks/use-proposals";
import { getApiErrorMessage } from "@/lib/api-error";
import { PDF_PLAN } from "@/lib/precon-meta";

interface Props {
  session: PreconSession;
}

/**
 * WS-M3B. The drawing this take-off measured has been superseded. The lines
 * stay as they are — they were true of that revision — and the way forward is
 * a fresh take-off on the newer plan, same mode and scope, which makes this
 * one's next revision.
 */
export function StaleRevisionBanner({ session }: Props) {
  const navigate = useNavigate();
  const proposalId = session.proposalId ?? "";
  const { data: plans = [] } = useProposalPlans(proposalId);
  const { data: workspace } = useProposalWorkspace(proposalId);
  const { data: sessions = [] } = usePreconSessions(proposalId || undefined);
  const measureAi = useCreatePreconSessionFromPlan(proposalId);
  const measureDwg = useStartProposalTakeoff(proposalId);
  const measureByHand = useCreatePreconSessionFromPlanWithMode(proposalId);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stale = session.stale;
  if (!stale || !proposalId) return null;
  const newerPlan = plans.find((p) => p.id === stale.newerPlanId) ?? null;
  const manual = session.takeoffKind === "manual";
  const revLabel = stale.newerRevision ? `Rev ${stale.newerRevision}` : "a newer revision";

  async function remeasure(scope: TakeoffScope) {
    if (!newerPlan) return;
    setError(null);
    try {
      let nextId: string | null = null;
      if (manual) {
        nextId = (await measureByHand.mutateAsync({ planId: newerPlan.id, scope, mode: "manual" })).id;
      } else if (PDF_PLAN.test(newerPlan.fileName)) {
        nextId = (await measureAi.mutateAsync({ planId: newerPlan.id, scope })).id;
      } else {
        nextId = (await measureDwg.mutateAsync(newerPlan.id)).sessionId ?? null;
      }
      setOpen(false);
      if (nextId) navigate(`/sales/takeoff/${nextId}`);
      else navigate(`/sales/proposals/${proposalId}?tab=takeoffs`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not start measuring the newer revision."));
    }
  }

  return (
    <>
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          The drawing has a newer revision ({revLabel}) — re-measure on it. These lines stay as measured on the revision they were drawn against.
        </span>
        <Button size="sm" variant="secondary" disabled={!newerPlan} title={newerPlan ? undefined : "Loading the drawings…"} onClick={() => setOpen(true)}>
          Re-measure on {revLabel}
        </Button>
      </div>
      {newerPlan ? (
        <MeasurePlanDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setError(null);
          }}
          plans={[{ id: newerPlan.id, fileName: newerPlan.fileName }]}
          mode={manual ? "manual" : "ai"}
          initialScope={session.scope}
          jobProfile={workspace?.proposal.jobProfile ?? null}
          existing={sessions
            .filter((s) => s.supersededBy === null && s.planId === newerPlan.id)
            .map((s) => ({ title: s.title, revision: s.revision, scope: s.scope, takeoffKind: s.takeoffKind }))}
          submitting={measureAi.isPending || measureDwg.isPending || measureByHand.isPending}
          error={error}
          onConfirm={(scope) => void remeasure(scope)}
        />
      ) : null}
    </>
  );
}
StaleRevisionBanner.displayName = "StaleRevisionBanner";
