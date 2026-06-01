import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import type { StageStatus } from "@/lib/project-mock-data";

export interface UpsertStageValues {
  name: string;
  status: StageStatus;
  startDate: string | null;
  endDate: string | null;
  progressPercent: number;
}

interface UpsertStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertStageValues>;
  onSubmit: (values: UpsertStageValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS_OPTIONS: { value: StageStatus; label: string }[] = [
  { value: "Pending", label: "Not started" },
  { value: "InProgress", label: "In progress" },
  { value: "Done", label: "Complete" },
];

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertStageDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertStageDialogProps) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<StageStatus>("Pending");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setStatus(initial?.status ?? "Pending");
      setStartDate(initial?.startDate ?? "");
      setEndDate(initial?.endDate ?? "");
      setProgress(initial?.progressPercent ?? 0);
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      status,
      startDate: startDate || null,
      endDate: endDate || null,
      progressPercent: Math.max(0, Math.min(100, Math.round(progress))),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Add stage" : "Edit stage"}
      description="Stages break the build into trackable phases (e.g. Foundation, Framing, Finishing)."
      submitLabel={mode === "create" ? "Add stage" : "Save changes"}
      submitDisabled={!name.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stage-name">Stage name</Label>
        <input
          id="stage-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Foundation & Substructure"
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stage-status">Status</Label>
        <select
          id="stage-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StageStatus)}
          className={field}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stage-start">Start date</Label>
          <input
            id="stage-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stage-end">Target end date</Label>
          <input
            id="stage-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="stage-progress">Progress ({progress}%)</Label>
        <input
          id="stage-progress"
          type="range"
          min={0}
          max={100}
          step={5}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          className="accent-[#004DE7]"
        />
      </div>
    </FormDrawer>
  );
}

UpsertStageDialog.displayName = "UpsertStageDialog";

export { UpsertStageDialog };
