import { useEffect, useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { useRevokeLookAheadApproval } from "@/hooks/use-look-aheads";
import { errorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { LookAhead } from "@/lib/project-types";

interface RevokeLookAheadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  lookAhead: LookAhead | null;
}

/**
 * An approved plan that has stopped being true goes back to Draft with a
 * reason, rather than the approver's name being quietly overwritten from the
 * edit drawer (finding F30).
 */
function RevokeLookAheadDialog({ open, onOpenChange, projectId, lookAhead }: RevokeLookAheadDialogProps) {
  const [reason, setReason] = useState("");
  const revoke = useRevokeLookAheadApproval();

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!lookAhead) return null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Revoke approval of ${lookAhead.name}?`}
      description={`${
        lookAhead.approvedByName
          ? `Approved by ${lookAhead.approvedByName}${
              lookAhead.approvedAt ? ` on ${new Date(lookAhead.approvedAt).toLocaleString()}` : ""
            }.`
          : "Marked approved with no approver on record."
      } Revoking returns the plan to Draft and clears the sign-off, so it has to be approved again.`}
      submitLabel="Revoke approval"
      submitting={revoke.isPending}
      error={revoke.error ? errorMessage(revoke.error) : null}
      onSubmit={() =>
        revoke.mutate(
          { projectId, lookAheadId: lookAhead.id, reason: reason.trim() || null },
          {
            onSuccess: () => {
              onOpenChange(false);
              toast("Approval revoked", "success");
            },
          },
        )
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="revoke-reason">Why is it being revoked?</Label>
        <textarea
          id="revoke-reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Culvert 1 works pulled out of the window after the NNPC stop-work notice."
          className={cn(INPUT_CLASS, "h-auto min-h-20 py-3")}
        />
      </div>
    </FormDialog>
  );
}

RevokeLookAheadDialog.displayName = "RevokeLookAheadDialog";

export { RevokeLookAheadDialog, type RevokeLookAheadDialogProps };
