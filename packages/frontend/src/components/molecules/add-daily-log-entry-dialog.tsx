import { useEffect, useState } from "react";
import { FormDialog } from "@/components/molecules/form-dialog";
import { RichTextField } from "@/components/molecules/rich-text-field";

interface AddDailyLogEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logDate: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (bodyHtml: string, bodyText: string) => void;
}

export function AddDailyLogEntryDialog({
  open,
  onOpenChange,
  logDate,
  submitting,
  error,
  onSubmit,
}: AddDailyLogEntryDialogProps) {
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) {
      setHtml("");
      setText("");
    }
  }, [open]);

  const hasContent = text.trim().length > 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Add your log — ${logDate}`}
      description="Record what you did on site today. Add photos with the image button. Your name and role are saved with the entry."
      submitLabel="Add entry"
      submitDisabled={!hasContent}
      submitting={submitting}
      error={error}
      onSubmit={() => onSubmit(html, text)}
    >
      <RichTextField
        label="What did you do today?"
        value={html}
        onChange={setHtml}
        onChangeText={setText}
        placeholder="e.g. Completed the level 3 slab pour, inspected rebar, flagged a delivery delay…"
      />
    </FormDialog>
  );
}
