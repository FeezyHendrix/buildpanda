import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";

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
        className="resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
      />
      <p className="text-[11px] text-gray-400">
        Minimum 10 characters · {trimmed.length}/2000
      </p>
    </div></FormDrawer>
  );
}

RaiseDisputeDialog.displayName = "RaiseDisputeDialog";

export { RaiseDisputeDialog, type RaiseDisputeDialogProps };
