import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { FormDialog } from "@/components/molecules/form-dialog";
import type { MaterialOrder } from "@/lib/project-types";
import { cn } from "@/lib/utils";

interface ForceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: MaterialOrder;
  /** The server's own words about why it refused the move. */
  serverMessage: string;
  onSubmit: (forceNote: string) => void;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Ordering a material whose approval is pending or rejected happens on real
 * jobs — the laterite was already on the road when the sample failed. The app
 * refuses it by default and takes a note when a PM overrides, so the decision
 * is attributable rather than silent.
 */
export function ForceOrderDialog({
  open,
  onOpenChange,
  order,
  serverMessage,
  onSubmit,
  isSubmitting,
  error,
}: ForceOrderDialogProps) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Order without the approval?"
      description={serverMessage}
      submitLabel="Order anyway"
      submitDisabled={note.trim().length === 0}
      submitting={isSubmitting}
      error={error}
      onSubmit={() => onSubmit(note.trim())}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="force-order-note">Why is this being ordered now?</Label>
        <textarea
          id="force-order-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={`e.g. Programme critical — ${order.materialName} needed on site before the sample result`}
          rows={3}
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3")}
        />
        <p className="text-xs text-ink-muted">
          The note is recorded on the order so the override stands with it.
        </p>
      </div>
    </FormDialog>
  );
}

ForceOrderDialog.displayName = "ForceOrderDialog";
