import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { Switcher } from "@/components/atoms/switcher";
import { FormDrawer } from "./form-drawer";
import type { KeyDateStatus } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";
import { CONTRACTUAL_LOCK_HINT, KEY_DATE_LINK_HINT } from "@/lib/key-date-meta";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export interface UpsertKeyDateValues {
  label: string;
  targetDate: string | null;
  actualDate: string | null;
  status: KeyDateStatus;
  notes: string | null;
  /** The activity that delivers this date; the cascade then carries it. */
  linkedActivityId: string | null;
  isContractual: boolean;
}

export interface KeyDateActivityChoice {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertKeyDateValues>;
  /** Set when the date has already been moved, to explain what it was. */
  revisedFrom?: string | null;
  activityOptions?: KeyDateActivityChoice[];
  onSubmit: (values: UpsertKeyDateValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS: KeyDateStatus[] = ["Upcoming", "Met", "Missed"];

const field = INPUT_CLASS;

function UpsertKeyDateDialog({
  open,
  onOpenChange,
  mode,
  initial,
  revisedFrom,
  activityOptions = [],
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [label, setLabel] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [actualDate, setActualDate] = useState("");
  const [status, setStatus] = useState<KeyDateStatus>("Upcoming");
  const [notes, setNotes] = useState("");
  const [linkedActivityId, setLinkedActivityId] = useState("");
  const [isContractual, setIsContractual] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? "");
      setTargetDate(initial?.targetDate ?? "");
      setActualDate(initial?.actualDate ?? "");
      setStatus(initial?.status ?? "Upcoming");
      setNotes(initial?.notes ?? "");
      setLinkedActivityId(initial?.linkedActivityId ?? "");
      setIsContractual(initial?.isContractual ?? false);
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!label.trim()) return;
    onSubmit({
      label: label.trim(),
      targetDate: targetDate || null,
      actualDate: actualDate || null,
      status,
      notes: notes.trim() || null,
      linkedActivityId: linkedActivityId || null,
      isContractual,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Add key date" : "Edit key date"}
      description="A milestone date to track (e.g. Roof on, Move-in target)."
      submitLabel={mode === "create" ? "Add" : "Save changes"}
      submitDisabled={!label.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kd-label">Label</Label>
        <input id="kd-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Roof on (weathertight)" className={field} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kd-target">Target date</Label>
          <input id="kd-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={field} />
          {revisedFrom ? (
            <p className="text-xs text-ink-muted">Revised from {formatShortDate(revisedFrom)}.</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kd-actual">Actual date</Label>
          <input id="kd-actual" type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} className={field} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kd-status">Status</Label>
        <select id="kd-status" value={status} onChange={(e) => setStatus(e.target.value as KeyDateStatus)} className={field}>
          {STATUS.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kd-activity">Delivered by (optional)</Label>
        <select
          id="kd-activity"
          value={linkedActivityId}
          onChange={(e) => setLinkedActivityId(e.target.value)}
          className={field}
        >
          <option value="">Not linked to an activity</option>
          {activityOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-ink-muted">{KEY_DATE_LINK_HINT}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kd-contractual">Contractual date</Label>
        <div className="flex items-center gap-3">
          <Switcher
            value={isContractual ? "yes" : "no"}
            onChange={(next) => setIsContractual(next === "yes")}
          />
          <span id="kd-contractual" className="text-xs text-ink-muted">
            {isContractual
              ? CONTRACTUAL_LOCK_HINT
              : "Practical completion and the defects-liability end are contract dates."}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kd-notes">Notes</Label>
        <textarea id="kd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(INPUT_CLASS, "h-auto min-h-24 py-3 lg:text-sm")} />
      </div>
    </FormDrawer>
  );
}

UpsertKeyDateDialog.displayName = "UpsertKeyDateDialog";

export { UpsertKeyDateDialog };
