import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDialog } from "./form-dialog";
import type { KeyDateStatus } from "@/lib/project-mock-data";

export interface UpsertKeyDateValues {
  label: string;
  targetDate: string | null;
  actualDate: string | null;
  status: KeyDateStatus;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertKeyDateValues>;
  onSubmit: (values: UpsertKeyDateValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS: KeyDateStatus[] = ["Upcoming", "Met", "Missed"];

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertKeyDateDialog({ open, onOpenChange, mode, initial, onSubmit, isSubmitting = false, error }: Props) {
  const [label, setLabel] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [actualDate, setActualDate] = useState("");
  const [status, setStatus] = useState<KeyDateStatus>("Upcoming");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? "");
      setTargetDate(initial?.targetDate ?? "");
      setActualDate(initial?.actualDate ?? "");
      setStatus(initial?.status ?? "Upcoming");
      setNotes(initial?.notes ?? "");
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
    });
  }

  return (
    <FormDialog
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
        <Label htmlFor="kd-notes">Notes</Label>
        <textarea id="kd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10" />
      </div>
    </FormDialog>
  );
}

UpsertKeyDateDialog.displayName = "UpsertKeyDateDialog";

export { UpsertKeyDateDialog };
