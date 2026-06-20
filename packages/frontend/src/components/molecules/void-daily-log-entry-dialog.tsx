import { useEffect, useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";

interface VoidDailyLogEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorName: string;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
}

export function VoidDailyLogEntryDialog({
  open,
  onOpenChange,
  authorName,
  submitting,
  error,
  onConfirm,
}: VoidDailyLogEntryDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const hasReason = reason.trim().length > 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Void this log entry?"
      description={`Voiding keeps ${authorName}'s entry on record but marks it invalid. The entry stays visible with the void reason and history. A reason is required.`}
      submitLabel="Void entry"
      submitDisabled={!hasReason}
      submitting={submitting}
      error={error}
      onSubmit={() => onConfirm(reason.trim())}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="void-entry-reason" className="text-sm font-medium text-gray-700">
          Reason for voiding
        </label>
        <textarea
          id="void-entry-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Explain why this entry is being voided…"
          className="min-h-20 rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDialog>
  );
}
