import { useEffect, useState } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { FormDialog } from "@/components/molecules/form-dialog";

interface AwardDaysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The days the claim asked for; the award defaults to it and is usually less. */
  daysClaimed: number;
  onSubmit: (daysAwarded: number) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

/**
 * Approving a time claim is the decision that actually buys time: the days
 * awarded move the revised completion date and every contractual key date by
 * that many calendar days. An engineer rarely grants the whole claim, so the
 * figure is asked for rather than assumed — and the gap between claimed and
 * awarded stays on the record as the negotiation it is.
 */
export function AwardDaysDialog({
  open,
  onOpenChange,
  daysClaimed,
  onSubmit,
  isSubmitting = false,
  error,
}: AwardDaysDialogProps) {
  const [days, setDays] = useState("0");

  useEffect(() => {
    if (open) setDays(String(daysClaimed));
  }, [open, daysClaimed]);

  const value = Number(days);
  const invalid = days.trim().length === 0 || !Number.isFinite(value) || value < 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Approve this time claim"
      description="The days you award move the revised completion date and every contractual key date by that many calendar days."
      submitLabel="Approve and award"
      submitDisabled={invalid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={() => onSubmit(Math.max(0, Math.trunc(value)))}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="award-days">Days awarded</Label>
        <input
          id="award-days"
          type="number"
          min={0}
          step={1}
          value={days}
          onChange={(event) => setDays(event.target.value)}
          aria-invalid={invalid || undefined}
          className={INPUT_CLASS}
        />
        {invalid ? (
          <p className="text-xs text-negative-600">
            Days awarded is required and cannot be negative.
          </p>
        ) : (
          <p className="text-xs text-ink-muted">
            {daysClaimed} {daysClaimed === 1 ? "day was" : "days were"} claimed. Award 0 to approve
            the change without granting time.
          </p>
        )}
      </div>
    </FormDialog>
  );
}

AwardDaysDialog.displayName = "AwardDaysDialog";
