import { useState } from "react";
import { Link } from "react-router-dom";
import { RadioCard } from "@/components/atoms/radio-card";
import { FormDialog } from "@/components/molecules/form-dialog";
import type { ProposalPlan } from "@/api/proposals";
import { formatShortDate } from "@/lib/formatters";
import { HAND_MEASURABLE_PLAN, PLAN_DISCIPLINE_LABEL } from "@/lib/precon-meta";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  plans: ProposalPlan[];
  onPick: (plan: ProposalPlan) => void;
}

/** Current PDF and DWG drawings: the only ones a person can draw on. */
function measurableDrawings(plans: ProposalPlan[]): ProposalPlan[] {
  return plans.filter((p) => p.revisionStatus === "current" && HAND_MEASURABLE_PLAN.test(p.fileName));
}

function drawingMeta(plan: ProposalPlan): string {
  return [
    plan.sheetCode,
    plan.discipline ? PLAN_DISCIPLINE_LABEL[plan.discipline] : null,
    plan.revision ? `Rev ${plan.revision}` : null,
    formatShortDate(plan.uploadedAt),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Step one of "Measure by hand" from the Take-offs tab: choose which drawing
 * to open. The scope and the session itself come from MeasurePlanDialog next.
 */
export function PickDrawingDialog({ open, onOpenChange, proposalId, plans, onPick }: Props) {
  const drawings = measurableDrawings(plans);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = drawings.find((p) => p.id === pickedId) ?? drawings[0] ?? null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Measure by hand"
      description="Which drawing do you want to measure? Its sheets open in the viewer for you to draw on."
      submitLabel="Next"
      submitDisabled={picked === null}
      onSubmit={() => {
        if (picked) onPick(picked);
      }}
      className="w-[min(560px,calc(100vw-2rem))]"
    >
      {drawings.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          No PDF or DWG drawing on this proposal yet.{" "}
          <Link to={`/sales/proposals/${proposalId}?tab=drawings`} className="font-medium text-primary-600 hover:underline">
            Upload one on the Drawings tab.
          </Link>
        </p>
      ) : (
        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {drawings.map((plan) => (
            <RadioCard
              key={plan.id}
              title={plan.fileName}
              description={drawingMeta(plan)}
              selected={picked?.id === plan.id}
              onClick={() => setPickedId(plan.id)}
              className="p-4"
            />
          ))}
        </div>
      )}
    </FormDialog>
  );
}
PickDrawingDialog.displayName = "PickDrawingDialog";
