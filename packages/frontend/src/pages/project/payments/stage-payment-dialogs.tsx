import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { RaiseDisputeDialog } from "@/components/molecules/raise-dispute-dialog";
import { useRaiseDispute, useReleaseMilestone } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import type { Currency, MilestonePayment } from "@/lib/project-types";

interface StagePaymentDialogsProps {
  projectId: string;
  currency: Currency;
  releaseTarget: MilestonePayment | null;
  disputeTarget: MilestonePayment | null;
  onReleaseClose: () => void;
  onDisputeClose: () => void;
}

/**
 * The two stage-payment dialogs — record a payment, raise a dispute — shared by
 * the Stage payments tab and the finance overview. Recording a payment logs a
 * movement that happened off-platform; BuildPanda never moves money.
 */
export function StagePaymentDialogs({
  projectId,
  currency,
  releaseTarget,
  disputeTarget,
  onReleaseClose,
  onDisputeClose,
}: StagePaymentDialogsProps) {
  const releaseMilestone = useReleaseMilestone();
  const raiseDispute = useRaiseDispute();

  return (
    <>
      <ConfirmDialog
        open={releaseTarget !== null}
        onOpenChange={(next) => {
          if (!next) onReleaseClose();
        }}
        title={`Record payment for ${releaseTarget?.name ?? "this stage"}?`}
        description={`Logs ${
          releaseTarget ? formatCurrency(releaseTarget.amount, currency) : ""
        } as paid to the contractor. This records a payment made off-platform — BuildPanda does not move money.`}
        confirmLabel="Record payment"
        cancelLabel="Cancel"
        loading={releaseMilestone.isPending}
        onConfirm={() => {
          if (!releaseTarget) return;
          releaseMilestone.mutate(
            { projectId, milestoneId: releaseTarget.id },
            { onSettled: onReleaseClose },
          );
        }}
      />

      <RaiseDisputeDialog
        open={disputeTarget !== null}
        onOpenChange={(next) => {
          if (!next) onDisputeClose();
        }}
        milestoneName={disputeTarget?.name ?? ""}
        isSubmitting={raiseDispute.isPending}
        error={raiseDispute.error ? (raiseDispute.error as Error).message : null}
        onSubmit={({ reason }) => {
          if (!disputeTarget) return;
          raiseDispute.mutate(
            { projectId, milestoneId: disputeTarget.id, reason },
            { onSuccess: onDisputeClose },
          );
        }}
      />
    </>
  );
}

StagePaymentDialogs.displayName = "StagePaymentDialogs";
