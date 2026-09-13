import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { INPUT_CLASS } from "@/components/atoms/input";
import { toLocalDateTimeInput, workingDaysLabel } from "@/lib/delay-meta";
import { formatShortDate } from "@/lib/formatters";
import type { ActivityDelay } from "@/lib/project-types";
import { cn } from "@/lib/utils";

export interface ResolveDelayValues {
  endedAt: string;
  daysLost: number;
  preventionNotes: string;
}

interface ResolveDelayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delay: ActivityDelay | null;
  onSubmit: (values: ResolveDelayValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

/**
 * Closing a delay is a measurement, not a tick: the PM states when work resumed
 * and how many working days were actually lost, and the cascade re-applies only
 * the difference against what this delay has already moved.
 */
function ResolveDelayDialog({
  open,
  onOpenChange,
  delay,
  onSubmit,
  isSubmitting = false,
  error,
}: ResolveDelayDialogProps) {
  const [endedAt, setEndedAt] = useState("");
  const [daysLost, setDaysLost] = useState("0");
  const [preventionNotes, setPreventionNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setEndedAt(toLocalDateTimeInput(delay?.endedAt ? new Date(delay.endedAt) : new Date()));
    setDaysLost(String(delay?.daysLost ?? 0));
    setPreventionNotes(delay?.preventionNotes ?? "");
  }, [open, delay]);

  const daysLostValue = Number(daysLost);
  const daysLostInvalid =
    daysLost.trim().length === 0 || !Number.isFinite(daysLostValue) || daysLostValue < 0;
  const endedBeforeStart =
    Boolean(endedAt) && Boolean(delay) && new Date(endedAt) < new Date(delay!.startedAt);
  const isValid = endedAt.length > 0 && !daysLostInvalid && !endedBeforeStart;

  const delta = delay ? Math.trunc(daysLostValue || 0) - delay.appliedShiftDays : 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      endedAt: new Date(endedAt).toISOString(),
      daysLost: Math.max(0, Math.trunc(daysLostValue)),
      preventionNotes: preventionNotes.trim(),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Resolve delay"
      description={
        delay
          ? `${delay.reasonName}, started ${formatShortDate(delay.startedAt)}. Record when work resumed and the time actually lost.`
          : ""
      }
      submitLabel="Resolve delay"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resolve-ended">Ended at</Label>
        <input
          id="resolve-ended"
          type="datetime-local"
          value={endedAt}
          onChange={(e) => setEndedAt(e.target.value)}
          aria-invalid={endedBeforeStart || undefined}
          className={INPUT_CLASS}
        />
        {endedBeforeStart ? (
          <p className="text-xs text-negative-600">Ended at cannot be before the delay started.</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resolve-days">Days lost (working days)</Label>
        <input
          id="resolve-days"
          type="number"
          min={0}
          step={1}
          value={daysLost}
          onChange={(e) => setDaysLost(e.target.value)}
          aria-invalid={daysLostInvalid || undefined}
          className={INPUT_CLASS}
        />
        {daysLostInvalid ? (
          <p className="text-xs text-negative-600">Days lost is required and cannot be negative.</p>
        ) : delay ? (
          <p className="text-xs text-ink-muted">
            {delta === 0
              ? `The programme already carries ${workingDaysLabel(delay.appliedShiftDays)} for this delay — nothing moves.`
              : `The programme moves a further ${workingDaysLabel(Math.abs(delta))} ${delta > 0 ? "later" : "earlier"}.`}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resolve-prevention">How can we prevent this?</Label>
        <textarea
          id="resolve-prevention"
          value={preventionNotes}
          onChange={(e) => setPreventionNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Optional, fill once known."
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 resize-none")}
        />
      </div>
    </FormDrawer>
  );
}

ResolveDelayDialog.displayName = "ResolveDelayDialog";

export { ResolveDelayDialog, type ResolveDelayDialogProps };
