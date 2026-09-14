import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";
import { FormDialog } from "@/components/molecules/form-dialog";
import { useActivityReferences } from "@/hooks/use-activity-references";
import { useDeleteActivity } from "@/hooks/use-activities";
import { useRevokeLookAheadApproval } from "@/hooks/use-look-aheads";
import { errorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Activity } from "@/lib/project-types";

interface DeleteActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  activity: Activity | null;
}

/**
 * Deleting an activity used to strip it silently out of an *approved* look-ahead
 * (finding F30). The confirm now names what points at it, and an approved plan
 * blocks the delete until the PM accepts that the plan drops back to Draft.
 */
function DeleteActivityDialog({ open, onOpenChange, projectId, activity }: DeleteActivityDialogProps) {
  const [acceptDraft, setAcceptDraft] = useState(false);
  const references = useActivityReferences(open ? projectId : undefined, activity?.id);
  const remove = useDeleteActivity();
  const revoke = useRevokeLookAheadApproval();

  const approved = (references.data?.lookAheads ?? []).filter((l) => l.status === "Approved");
  const blocked = approved.length > 0 && !acceptDraft;
  const openDelays = references.data?.openDelayCount ?? 0;

  async function confirm(): Promise<void> {
    if (!activity || blocked) return;
    for (const lookAhead of approved) {
      await revoke.mutateAsync({
        projectId,
        lookAheadId: lookAhead.id,
        reason: `Dropped to Draft: "${activity.name}" was removed from the programme.`,
      });
    }
    remove.mutate(
      { projectId, activityId: activity.id },
      {
        onSuccess: () => {
          onOpenChange(false);
          setAcceptDraft(false);
          toast(
            approved.length > 0
              ? `Activity deleted · ${approved.length} look-ahead${approved.length === 1 ? "" : "s"} dropped to Draft`
              : "Activity deleted",
            "success",
          );
        },
      },
    );
  }

  if (!activity) return null;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setAcceptDraft(false);
      }}
      title={`Delete ${activity.name}?`}
      description="This permanently removes the activity and its logged delays. It cannot be undone."
      submitLabel={approved.length > 0 ? "Remove and drop to Draft" : "Delete"}
      submitDisabled={blocked || references.isPending}
      submitting={remove.isPending || revoke.isPending}
      error={errorMessage(remove.error ?? revoke.error, "") || null}
      onSubmit={confirm}
    >
      {references.isPending ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          {openDelays > 0 ? (
            <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
              ⚠ {openDelays} open delay{openDelays === 1 ? "" : "s"} logged against this activity will be
              deleted with it.
            </p>
          ) : null}

          {(references.data?.lookAheads.length ?? 0) > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase text-ink-muted">Referenced by look-aheads</p>
              <ul className="flex flex-col gap-1.5">
                {references.data!.lookAheads.map((lookAhead) => (
                  <li key={lookAhead.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-gray-900">{lookAhead.name}</span>
                    <Badge tone={lookAhead.status === "Approved" ? "danger" : "neutral"} size="sm">
                      {lookAhead.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {approved.length > 0 ? (
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-xs",
                acceptDraft ? "border-primary-500 bg-primary-50" : "border-line-hair bg-white",
              )}
            >
              <input
                type="checkbox"
                checked={acceptDraft}
                onChange={(event) => setAcceptDraft(event.target.checked)}
                className="mt-0.5"
              />
              <span className="text-gray-700">
                An approved look-ahead relies on this activity. Deleting it drops{" "}
                {approved.length === 1 ? "that plan" : `those ${approved.length} plans`} back to Draft so the
                sign-off is not silently rewritten. Tick to continue.
              </span>
            </label>
          ) : null}
        </div>
      )}
    </FormDialog>
  );
}

DeleteActivityDialog.displayName = "DeleteActivityDialog";

export { DeleteActivityDialog, type DeleteActivityDialogProps };
