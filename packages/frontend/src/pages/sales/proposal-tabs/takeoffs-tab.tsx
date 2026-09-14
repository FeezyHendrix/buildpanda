import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MeasurePlanDialog } from "@/components/molecules/proposal-plans/measure-plan-dialog";
import { PickDrawingDialog } from "@/components/molecules/proposal-plans/pick-drawing-dialog";
import { TakeoffTable } from "@/components/molecules/proposal-plans/takeoff-table";
import type { TakeoffScope } from "@/api/precon";
import type { ProposalPlan } from "@/api/proposals";
import { useCreatePreconSessionFromPlanWithMode, usePreconSessions } from "@/hooks/use-precon";
import { useProposalPlans, useProposalWorkspace } from "@/hooks/use-proposals";
import { getApiErrorMessage } from "@/lib/api-error";

interface Props {
  proposalId: string;
}

// The take-off is the unpriced bill of quantities. This tab lists every
// current take-off on the proposal as one table; a row opens the take-off
// workspace, where the lines, evidence and verification live. Its one action
// starts a hand take-off: pick a drawing, pick a scope, draw.
export function TakeoffsTab({ proposalId }: Props) {
  const navigate = useNavigate();
  const { data: sessions = [], isPending } = usePreconSessions(proposalId);
  const { data: plans = [] } = useProposalPlans(proposalId);
  const { data: workspace } = useProposalWorkspace(proposalId);
  const measureByHand = useCreatePreconSessionFromPlanWithMode(proposalId);

  const [picking, setPicking] = useState(false);
  const [target, setTarget] = useState<ProposalPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = (scope: TakeoffScope) => {
    if (!target) return;
    setError(null);
    measureByHand.mutate(
      { planId: target.id, scope, mode: "manual" },
      {
        onSuccess: (session) => {
          setTarget(null);
          navigate(`/sales/takeoff/${session.id}`);
        },
        onError: (err) => setError(getApiErrorMessage(err, "Could not open the drawing for measuring.")),
      },
    );
  };

  return (
    <>
      <TakeoffTable sessions={sessions} isLoading={isPending} onMeasureByHand={() => setPicking(true)} />
      <PickDrawingDialog
        open={picking}
        onOpenChange={setPicking}
        proposalId={proposalId}
        plans={plans}
        onPick={(plan) => {
          setPicking(false);
          setError(null);
          setTarget(plan);
        }}
      />
      <MeasurePlanDialog
        mode="manual"
        jobProfile={workspace?.proposal.jobProfile ?? null}
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        plans={target ? [{ id: target.id, fileName: target.fileName }] : []}
        existing={sessions
          .filter((s) => s.supersededBy === null && s.planId === target?.id)
          .map((s) => ({ title: s.title, revision: s.revision, scope: s.scope, takeoffKind: s.takeoffKind }))}
        submitting={measureByHand.isPending}
        error={error}
        onConfirm={start}
      />
    </>
  );
}
TakeoffsTab.displayName = "TakeoffsTab";
