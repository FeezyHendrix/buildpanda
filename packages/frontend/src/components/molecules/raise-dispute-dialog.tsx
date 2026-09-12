import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

interface RaiseDisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestoneName: string;
  onSubmit: (input: { reason: string }) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function RaiseDisputeDialog({
  open,
  onOpenChange,
  milestoneName,
  onSubmit,
  isSubmitting = false,
  error,
}: RaiseDisputeDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const trimmed = reason.trim();
  const isValid = trimmed.length >= 10;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({ reason: trimmed });
  }

  return (
    <FormDrawer open={open}
    onOpenChange={onOpenChange}
    title={`Raise dispute on ${milestoneName}`}
    description="Describe what's wrong. The release is paused while the dispute is open."
    submitLabel="Raise dispute"
    submitDisabled={!isValid}
    submitting={isSubmitting}
    error={error ?? null}
    onSubmit={handleSubmit}><div className="flex flex-col gap-1.5">
      <Label htmlFor="dispute-reason">Reason</Label>
      <textarea
        id="dispute-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={5}
        autoFocus
        maxLength={2000}
        placeholder="e.g. Roofing material does not match the specification on the BoQ. Colour and gauge differ from sample."
        className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 resize-none")}
      />
      <p className="text-xs text-gray-400">
        Minimum 10 characters · {trimmed.length}/2000
      </p>
    </div></FormDrawer>
  );
}

RaiseDisputeDialog.displayName = "RaiseDisputeDialog";

export { RaiseDisputeDialog, type RaiseDisputeDialogProps };
