import { useEffect, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { FormDialog } from "@/components/molecules/form-dialog";
import { formatCurrency } from "@/lib/formatters";
import type { EquipmentRequest } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { formatEquipmentDate, hireDaysBetween } from "./equipment-helpers";

interface ExtendHireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: EquipmentRequest;
  onSubmit: (values: { offHireAt: string; reason: string | null }) => void;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Extending a hire is a variation on the hire order, not an edit of a date: the
 * original off-hire has to survive for the plant-hire reconciliation, so every
 * push is recorded and the cost recomputes from the rate.
 */
export function ExtendHireDialog({
  open,
  onOpenChange,
  request,
  onSubmit,
  isSubmitting,
  error,
}: ExtendHireDialogProps) {
  const [offHireAt, setOffHireAt] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setOffHireAt(request.offHireAt?.slice(0, 10) ?? request.neededUntil.slice(0, 10));
    setReason("");
  }, [open, request]);

  const current = request.offHireAt ?? request.neededUntil;
  const days = hireDaysBetween(request.onHireAt ?? request.neededFrom, offHireAt || null);
  const rate = request.dailyRate;
  const newCost = days !== null && rate !== null && rate !== undefined ? rate * days : null;
  const later = Boolean(offHireAt) && offHireAt > (current?.slice(0, 10) ?? "");

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Extend the hire"
      description={`${request.equipmentName} is currently off hire on ${formatEquipmentDate(current)}.`}
      submitLabel="Record extension"
      submitDisabled={!offHireAt || !later}
      submitting={isSubmitting}
      error={error}
      onSubmit={() => onSubmit({ offHireAt, reason: reason.trim() || null })}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="extend-off-hire">New off-hire date</Label>
        <input
          id="extend-off-hire"
          type="date"
          value={offHireAt}
          onChange={(event) => setOffHireAt(event.target.value)}
          className={INPUT_CLASS}
        />
        {offHireAt && !later ? (
          <p className="text-xs text-negative-500">
            An extension has to run past {formatEquipmentDate(current)}.
          </p>
        ) : (
          <p className="text-xs text-ink-muted">
            The original off-hire stays on the record as the first period.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="extend-reason">Reason</Label>
        <textarea
          id="extend-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Formation works running over, rain days, extra chainage…"
          rows={3}
          className={cn(INPUT_CLASS, "h-auto min-h-20 py-3")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-alt p-3 text-sm">
        <Badge tone="info" size="sm" variant="outline">
          {request.extensions.length} previous extension
          {request.extensions.length === 1 ? "" : "s"}
        </Badge>
        <span className="text-ink-muted tabular-nums">
          {days === null
            ? "Pick a date to see the hire length."
            : newCost === null
              ? `${days} day${days === 1 ? "" : "s"} on hire — no daily rate recorded.`
              : `${days} day${days === 1 ? "" : "s"} on hire = ${formatCurrency(newCost, request.currency)}`}
        </span>
      </div>
    </FormDialog>
  );
}

ExtendHireDialog.displayName = "ExtendHireDialog";
