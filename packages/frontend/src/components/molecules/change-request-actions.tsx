import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { AwardDaysDialog } from "@/components/molecules/award-days-dialog";
import { ReasonDialog } from "@/components/molecules/reason-dialog";
import { useChangeRequestAction } from "@/hooks/use-change-requests";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import type { ChangeAction, ChangeRequestDetail, ChangeStatus } from "@/lib/project-types";

/**
 * The change-order ladder, as the actions that walk it.
 *
 * A change is a contractual negotiation: the contractor proposes, the engineer
 * or employer decides. So the status is never picked from a select — each
 * action is a decision with an actor, a timestamp and, for a rejection or a
 * resubmission, a reason. The submitter cannot approve their own request; the
 * API answers 409 and the message is surfaced verbatim.
 */

/** What each status may do next, in the order a QS would reach for it. */
const NEXT_ACTIONS: Record<ChangeStatus, readonly ChangeAction[]> = {
  Draft: ["submit"],
  Submitted: ["approve", "reject"],
  Approved: ["execute"],
  Rejected: ["resubmit"],
  Executed: [],
};

const ACTION_META: Record<
  ChangeAction,
  { label: string; variant: "primary" | "secondary"; danger?: boolean; reason?: { title: string; description: string; label: string; placeholder: string; submitLabel: string } }
> = {
  submit: { label: "Submit for decision", variant: "primary" },
  approve: { label: "Approve", variant: "primary" },
  reject: {
    label: "Reject",
    variant: "secondary",
    danger: true,
    reason: {
      title: "Reject this change",
      description:
        "A rejection is a contractual decision. The reason goes on the record with your name and the date, and the contractor can revise and resubmit against it.",
      label: "Why is it rejected?",
      placeholder: "e.g. Rate for lined drain exceeds the BoQ rate; resubmit at the contract rate.",
      submitLabel: "Reject change",
    },
  },
  resubmit: {
    label: "Revise and resubmit",
    variant: "primary",
    reason: {
      title: "Resubmit this change",
      description:
        "The current cost and time impact are captured as a new revision, so the negotiation stays on the record rather than the list silently showing the latest figure.",
      label: "What changed since the rejection?",
      placeholder: "e.g. Re-priced at the BoQ rate of ₦35,000/m; quantity unchanged.",
      submitLabel: "Resubmit change",
    },
  },
  execute: { label: "Mark executed", variant: "secondary" },
};

interface ChangeRequestActionsProps {
  projectId: string;
  cr: ChangeRequestDetail;
}

export function ChangeRequestActions({ projectId, cr }: ChangeRequestActionsProps) {
  const run = useChangeRequestAction();
  const [reasonFor, setReasonFor] = useState<ChangeAction | null>(null);
  const [awarding, setAwarding] = useState(false);

  const available = NEXT_ACTIONS[cr.status];
  // Approving a time claim is an award of days, not a yes/no — it asks how many.
  const isTimeClaim = cr.type === "eot_only";

  function perform(action: ChangeAction, extra: { reason?: string; daysAwarded?: number } = {}): void {
    run.mutate(
      { projectId, changeId: cr.id, action, ...extra },
      {
        onSuccess: () => {
          setReasonFor(null);
          setAwarding(false);
          toast(`Change ${ACTION_META[action].label.toLowerCase()}`, "success");
        },
        // 409s land here: "you cannot approve your own change request",
        // "sign the change order contract before executing it".
        onError: (error) => toast(getApiErrorMessage(error), "error"),
      },
    );
  }

  if (available.length === 0) {
    return (
      <p className="text-xs text-ink-muted">
        This change is executed — the contract and the stage dates have already moved with it.
      </p>
    );
  }

  const pendingReason = reasonFor ? ACTION_META[reasonFor].reason : undefined;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {available.map((action) => {
          const meta = ACTION_META[action];
          return (
            <Button
              key={action}
              type="button"
              variant={meta.variant}
              size="md"
              className={meta.danger ? "text-negative-500" : undefined}
              loading={run.isPending && reasonFor === null && !awarding}
              onClick={() => {
                if (meta.reason) setReasonFor(action);
                else if (action === "approve" && isTimeClaim) setAwarding(true);
                else perform(action);
              }}
            >
              {action === "approve" && isTimeClaim ? "Approve and award days" : meta.label}
            </Button>
          );
        })}
      </div>

      {pendingReason ? (
        <ReasonDialog
          open={reasonFor !== null}
          onOpenChange={(open) => {
            if (!open) setReasonFor(null);
          }}
          title={pendingReason.title}
          description={pendingReason.description}
          label={pendingReason.label}
          placeholder={pendingReason.placeholder}
          submitLabel={pendingReason.submitLabel}
          isSubmitting={run.isPending}
          error={run.error ? getApiErrorMessage(run.error) : null}
          onSubmit={(reason) => {
            if (reasonFor) perform(reasonFor, { reason });
          }}
        />
      ) : null}

      <AwardDaysDialog
        open={awarding}
        onOpenChange={setAwarding}
        daysClaimed={cr.timeImpactDays}
        isSubmitting={run.isPending}
        error={run.error ? getApiErrorMessage(run.error) : null}
        onSubmit={(daysAwarded) => perform("approve", { daysAwarded })}
      />
    </>
  );
}

ChangeRequestActions.displayName = "ChangeRequestActions";
