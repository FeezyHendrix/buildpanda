import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { INPUT_CLASS } from "@/components/atoms/input";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { cn } from "@/lib/utils";
import type { EotClaim, EotDecision } from "@/api/extensions-of-time";

export interface DecideEotValues {
  decision: EotDecision;
  daysAwarded: number;
  notes: string | null;
}

interface DecideEotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: EotClaim | null;
  onSubmit: (values: DecideEotValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const DECISIONS: { value: EotDecision; label: string }[] = [
  { value: "Approved", label: "Approve — award time" },
  { value: "Rejected", label: "Reject — award nothing" },
];

/**
 * The decision is the contractual act: approving awards calendar days, moves
 * the project's revised completion date and carries every contractual key date
 * with it. Rejecting awards nothing and leaves the dates where they are.
 */
function DecideEotDialog({
  open,
  onOpenChange,
  claim,
  onSubmit,
  isSubmitting = false,
  error,
}: DecideEotDialogProps) {
  const [decision, setDecision] = useState<EotDecision>("Approved");
  const [daysAwarded, setDaysAwarded] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDecision("Approved");
    setDaysAwarded(String(claim?.daysClaimed ?? 0));
    setNotes("");
  }, [open, claim]);

  const daysValue = Number(daysAwarded);
  const daysInvalid =
    decision === "Approved" &&
    (daysAwarded.trim().length === 0 || !Number.isFinite(daysValue) || daysValue < 0);
  const isValid = claim !== null && !daysInvalid;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      decision,
      daysAwarded: decision === "Approved" ? Math.max(0, Math.trunc(daysValue)) : 0,
      notes: notes.trim() || null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={claim ? `Decide ${claim.reference}` : "Decide claim"}
      description={
        claim
          ? `${claim.title} — ${claim.daysClaimed} calendar ${claim.daysClaimed === 1 ? "day" : "days"} claimed.`
          : ""
      }
      submitLabel={decision === "Approved" ? "Award time" : "Reject claim"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eot-decision">Decision</Label>
        <select
          id="eot-decision"
          value={decision}
          onChange={(e) => setDecision(e.target.value as EotDecision)}
          className={INPUT_CLASS}
        >
          {DECISIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {decision === "Approved" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eot-awarded">Days awarded (calendar days)</Label>
          <input
            id="eot-awarded"
            type="number"
            min={0}
            step={1}
            value={daysAwarded}
            onChange={(e) => setDaysAwarded(e.target.value)}
            aria-invalid={daysInvalid || undefined}
            className={INPUT_CLASS}
          />
          {daysInvalid ? (
            <p className="text-xs text-negative-600">Days awarded cannot be negative.</p>
          ) : (
            <p className="text-xs text-ink-muted">
              The revised completion date and every contractual key date move by this many days.
            </p>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eot-decision-notes">Notes</Label>
        <textarea
          id="eot-decision-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={8000}
          placeholder="The reasoning a dispute would be argued from."
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 resize-none")}
        />
      </div>
    </FormDrawer>
  );
}

DecideEotDialog.displayName = "DecideEotDialog";

export { DecideEotDialog, type DecideEotDialogProps };
