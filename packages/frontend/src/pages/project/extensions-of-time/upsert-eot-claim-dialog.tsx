import { useEffect, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Label } from "@/components/atoms/label";
import { INPUT_CLASS } from "@/components/atoms/input";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { CULPABILITY_META, workingDaysLabel } from "@/lib/delay-meta";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { EotClaim } from "@/api/extensions-of-time";
import type { Culpability } from "@/lib/project-types";
import { totalDaysLost, type ClaimableDelay } from "./eot-meta";

export interface UpsertEotClaimValues {
  title: string;
  daysClaimed: number;
  reason: string | null;
  delayIds: string[];
  notes: string | null;
}

interface UpsertEotClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: EotClaim | null;
  delays: ClaimableDelay[];
  onSubmit: (values: UpsertEotClaimValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function DelayOption({
  item,
  checked,
  onToggle,
}: {
  item: ClaimableDelay;
  checked: boolean;
  onToggle: () => void;
}) {
  const meta = CULPABILITY_META[item.delay.culpability as Culpability] ?? CULPABILITY_META.neutral;
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-surface-alt">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 accent-primary-500"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{item.activityName}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>{item.delay.reasonName}</span>
            <span>·</span>
            <span>{formatShortDate(item.delay.startedAt)}</span>
            <span>·</span>
            <span className="tabular-nums">{workingDaysLabel(item.delay.daysLost)}</span>
            <Badge tone={meta.tone} size="sm">
              {meta.glyph} {meta.short}
            </Badge>
          </span>
        </span>
      </label>
    </li>
  );
}

DelayOption.displayName = "DelayOption";

/**
 * A claim is argued from delays, not typed from memory: the picker offers only
 * the EOT-claimable ones, because the server rejects a claim that cites a
 * contractor-culpable delay and names it.
 */
function UpsertEotClaimDialog({
  open,
  onOpenChange,
  initial,
  delays,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertEotClaimDialogProps) {
  const isEdit = Boolean(initial);
  const [title, setTitle] = useState("");
  const [daysClaimed, setDaysClaimed] = useState("0");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setDaysClaimed(String(initial?.daysClaimed ?? 0));
    setReason(initial?.reason ?? "");
    setNotes(initial?.notes ?? "");
    setSelected(new Set(initial?.delayIds ?? []));
  }, [open, initial]);

  function toggle(id: string): void {
    setSelected((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const citedDays = totalDaysLost(delays, selected);
  const daysValue = Number(daysClaimed);
  const daysInvalid = daysClaimed.trim().length === 0 || !Number.isFinite(daysValue) || daysValue < 0;
  const isValid = title.trim().length > 0 && !daysInvalid;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      title: title.trim(),
      daysClaimed: Math.max(0, Math.trunc(daysValue)),
      reason: reason.trim() || null,
      delayIds: [...selected],
      notes: notes.trim() || null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? `Edit ${initial?.reference}` : "New extension of time claim"}
      description="An award moves the completion date and every contractual key date by that many calendar days."
      submitLabel={isEdit ? "Save changes" : "Create claim"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      width="lg"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eot-title">Title</Label>
        <input
          id="eot-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Utility diversion at ch 1+200"
          maxLength={200}
          autoFocus
          className={INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eot-days">Days claimed (calendar days)</Label>
        <input
          id="eot-days"
          type="number"
          min={0}
          step={1}
          value={daysClaimed}
          onChange={(e) => setDaysClaimed(e.target.value)}
          aria-invalid={daysInvalid || undefined}
          className={INPUT_CLASS}
        />
        {daysInvalid ? (
          <p className="text-xs text-negative-600">Days claimed is required and cannot be negative.</p>
        ) : (
          <p className="text-xs text-ink-muted">
            {selected.size > 0
              ? `The delays you have cited lost ${workingDaysLabel(citedDays)}.`
              : "A claim must state days before it can be submitted."}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eot-delays">Delays claimed against</Label>
        {delays.length === 0 ? (
          <p id="eot-delays" className="rounded-lg bg-surface-alt p-3 text-sm text-ink-muted">
            No claimable delays yet. A delay becomes claimable when it is the client's risk or a
            neutral event — a contractor-culpable delay never is.
          </p>
        ) : (
          <ul
            id="eot-delays"
            className="max-h-64 divide-y divide-line-hair overflow-y-auto rounded-lg border border-line-hair"
          >
            {delays.map((item) => (
              <DelayOption
                key={item.delay.id}
                item={item}
                checked={selected.has(item.delay.id)}
                onToggle={() => toggle(item.delay.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eot-reason">Grounds for the claim</Label>
        <textarea
          id="eot-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={8000}
          placeholder="The contractual basis and the effect on the critical path."
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 resize-none")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eot-notes">Notes</Label>
        <textarea
          id="eot-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={8000}
          className={cn(INPUT_CLASS, "h-auto min-h-20 py-3 resize-none")}
        />
      </div>
    </FormDrawer>
  );
}

UpsertEotClaimDialog.displayName = "UpsertEotClaimDialog";

export { UpsertEotClaimDialog, type UpsertEotClaimDialogProps };
