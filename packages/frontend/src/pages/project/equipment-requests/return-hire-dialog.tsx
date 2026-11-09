import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { FormDialog } from "@/components/molecules/form-dialog";
import { formatCurrency } from "@/lib/formatters";
import type { EquipmentRequest } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { hireDaysBetween } from "./equipment-helpers";

interface ReturnHireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: EquipmentRequest;
  onSubmit: (values: { offHireAt: string; notes: string | null }) => void;
  isSubmitting: boolean;
  error: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returning plant needs the date it actually came off hire — that is what the
 * hire is invoiced to. The server refuses a return without it, so the dialog
 * asks rather than letting a one-click move fail.
 */
export function ReturnHireDialog({
  open,
  onOpenChange,
  request,
  onSubmit,
  isSubmitting,
  error,
}: ReturnHireDialogProps) {
  const [offHireAt, setOffHireAt] = useState(todayIso());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setOffHireAt(request.offHireAt?.slice(0, 10) ?? todayIso());
    setNotes("");
  }, [open, request]);

  const days = hireDaysBetween(request.onHireAt ?? request.neededFrom, offHireAt || null);
  const rate = request.dailyRate;
  const cost = days !== null && rate !== null && rate !== undefined ? rate * days : null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Return the plant"
      description={`Record when ${request.equipmentName} came off hire so the hire period closes at the right date.`}
      submitLabel="Record return"
      submitDisabled={!offHireAt}
      submitting={isSubmitting}
      error={error}
      onSubmit={() => onSubmit({ offHireAt, notes: notes.trim() || null })}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="return-off-hire">Off-hire date</Label>
        <input
          id="return-off-hire"
          type="date"
          value={offHireAt}
          onChange={(event) => setOffHireAt(event.target.value)}
          className={INPUT_CLASS}
        />
        <p className="text-xs text-ink-muted tabular-nums">
          {days === null
            ? "Pick the date the plant came off hire."
            : cost === null
              ? `${days} day${days === 1 ? "" : "s"} on hire — no daily rate recorded.`
              : `${days} day${days === 1 ? "" : "s"} on hire = ${formatCurrency(cost, request.currency)}`}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="return-notes">Condition on return</Label>
        <textarea
          id="return-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Damage, hours run, fuel state…"
          rows={3}
          className={cn(INPUT_CLASS, "h-auto min-h-20 py-3")}
        />
      </div>
    </FormDialog>
  );
}

ReturnHireDialog.displayName = "ReturnHireDialog";
