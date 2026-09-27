import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";

interface CancelInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionTitle: string;
  onSubmit: (reason: string) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

/**
 * Calling the service order off. Only the person who ordered it (or BuildPanda)
 * may do so, and never once the report has been issued — an issued report is an
 * independent record, so an unwanted inspection is cancelled, not erased.
 */
function CancelInspectionDialog({
  open,
  onOpenChange,
  inspectionTitle,
  onSubmit,
  isSubmitting = false,
  error,
}: CancelInspectionDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancel — ${inspectionTitle}`}
      description="Say why the visit is no longer wanted. The inspector and the contractor both see this request, so the reason belongs with it."
      submitLabel="Cancel inspection"
      cancelLabel="Keep it"
      submitDisabled={reason.trim().length === 0}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cancel-inspection-reason">Reason</Label>
        <textarea
          id="cancel-inspection-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="e.g. Earthworks pushed to December — will re-request nearer the time."
          className={cn(INPUT_CLASS, "h-auto min-h-24 resize-none py-3")}
        />
      </div>
    </FormDrawer>
  );
}

CancelInspectionDialog.displayName = "CancelInspectionDialog";

export { CancelInspectionDialog, type CancelInspectionDialogProps };
