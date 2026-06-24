import { useEffect, useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";

interface VoidMaterialEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryLabel: string;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
}

export function VoidMaterialEntryDialog({
  open,
  onOpenChange,
  entryLabel,
  submitting,
  error,
  onConfirm,
}: VoidMaterialEntryDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const hasReason = reason.trim().length > 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Void this entry?"
      description={`${entryLabel} The original stays in the log; a reversing entry restores stock. A reason is required.`}
      submitLabel="Void entry"
      submitDisabled={!hasReason}
      submitting={submitting}
      error={error}
      onSubmit={() => onConfirm(reason.trim())}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="void-reason" className="text-sm font-medium text-gray-700">
          Reason for voiding
        </label>
        <textarea
          id="void-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Explain why this entry is being voided…"
          className="min-h-20 rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDialog>
  );
}
