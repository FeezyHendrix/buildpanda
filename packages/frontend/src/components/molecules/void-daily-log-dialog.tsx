import { useEffect, useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { RichTextEditor } from "@/components/molecules/rich-text-editor";

interface VoidDailyLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logDate: string;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
}

export function VoidDailyLogDialog({
  open,
  onOpenChange,
  logDate,
  submitting,
  error,
  onConfirm,
}: VoidDailyLogDialogProps) {
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) {
      setHtml("");
      setText("");
    }
  }, [open]);

  const hasReason = text.trim().length > 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Void daily log — ${logDate}`}
      description="Voiding keeps the record but marks it as no longer valid. A reason is required and will be saved with your name."
      submitLabel="Void log"
      submitDisabled={!hasReason}
      submitting={submitting}
      error={error}
      onSubmit={() => onConfirm(html)}
    >
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">Reason for voiding</label>
        <RichTextEditor
          value={html}
          onChange={(h, t) => {
            setHtml(h);
            setText(t);
          }}
          placeholder="Explain why this log is being voided…"
        />
      </div>
    </FormDialog>
  );
}
