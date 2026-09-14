import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { FormDialog } from "@/components/molecules/form-dialog";
import { cn } from "@/lib/utils";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (reason: string) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

/**
 * Cancelling or rejecting a procurement record keeps it on file with the reason
 * attached — deleting it would erase a contractual decision. Every one of those
 * actions asks the same single question, so they all come through here.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  submitLabel,
  onSubmit,
  isSubmitting = false,
  error,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      submitLabel={submitLabel}
      submitDisabled={reason.trim().length === 0}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={() => onSubmit(reason.trim())}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reason-dialog-text">{label}</Label>
        <textarea
          id="reason-dialog-text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3")}
        />
      </div>
    </FormDialog>
  );
}

ReasonDialog.displayName = "ReasonDialog";
