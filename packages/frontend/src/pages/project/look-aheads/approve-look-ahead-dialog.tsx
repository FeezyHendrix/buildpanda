import { useEffect, useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { useApproveLookAhead } from "@/hooks/use-look-aheads";
import { errorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { LookAhead } from "@/lib/project-types";
import { formatLookAheadDate } from "./look-ahead-helpers";

interface ApproveLookAheadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  lookAhead: LookAhead | null;
}

/**
 * Approving a look-ahead is a sign-off: it records who approved it and when, so
 * the two-week plan is a record rather than a dropdown value (finding F29).
 */
function ApproveLookAheadDialog({ open, onOpenChange, projectId, lookAhead }: ApproveLookAheadDialogProps) {
  const [note, setNote] = useState("");
  const approve = useApproveLookAhead();

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  if (!lookAhead) return null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Approve ${lookAhead.name}?`}
      description={`${formatLookAheadDate(lookAhead.startDate)} – ${formatLookAheadDate(lookAhead.endDate)} · ${lookAhead.activities.length} activities. Your name and the time are recorded against the approval.`}
      submitLabel="Approve"
      submitting={approve.isPending}
      error={approve.error ? errorMessage(approve.error) : null}
      onSubmit={() =>
        approve.mutate(
          { projectId, lookAheadId: lookAhead.id, note: note.trim() || null },
          {
            onSuccess: () => {
              onOpenChange(false);
              toast("Look ahead approved", "success");
            },
          },
        )
      }
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="approve-note">Note (optional)</Label>
        <textarea
          id="approve-note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. Approved subject to TMP being in place before ch 1+200 works start."
          className={cn(INPUT_CLASS, "h-auto min-h-20 py-3")}
        />
      </div>
    </FormDialog>
  );
}

ApproveLookAheadDialog.displayName = "ApproveLookAheadDialog";

export { ApproveLookAheadDialog, type ApproveLookAheadDialogProps };
