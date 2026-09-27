import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { FormDrawer } from "./form-drawer";
import type { StageStatus } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";
import { currencySymbol, formatWholeCurrency } from "@/lib/formatters";

export interface UpsertStageValues {
  name: string;
  status: StageStatus;
  startDate: string | null;
  endDate: string | null;
  progressPercent: number;
  /** The stage's share of the contract sum; a phase without one is half a record. */
  value: number;
}

interface UpsertStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertStageValues>;
  /** What is still unallocated against the contract sum, for the helper line. */
  unallocated?: number;
  currency?: string;
  onSubmit: (values: UpsertStageValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS_OPTIONS: { value: StageStatus; label: string }[] = [
  { value: "Pending", label: "Not started" },
  { value: "InProgress", label: "In progress" },
  { value: "Done", label: "Complete" },
];

const field = INPUT_CLASS;

function UpsertStageDialog({
  open,
  onOpenChange,
  mode,
  initial,
  unallocated,
  currency = "NGN",
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertStageDialogProps) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<StageStatus>("Pending");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [progress, setProgress] = useState(0);
  const [value, setValue] = useState("0");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setStatus(initial?.status ?? "Pending");
      setStartDate(initial?.startDate ?? "");
      setEndDate(initial?.endDate ?? "");
      setProgress(initial?.progressPercent ?? 0);
      setValue(String(initial?.value ?? 0));
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
      value: Math.max(0, Number(value) || 0),
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
        <Label htmlFor="stage-value">Stage value</Label>
        <MoneyInput
          id="stage-value"
          value={value}
          onChange={setValue}
          currencySymbol={currencySymbol(currency)}
          placeholder="0.00"
        />
        <p className="text-xs text-ink-muted">
          {typeof unallocated === "number"
            ? `${formatWholeCurrency(Math.abs(unallocated), currency)} ${unallocated < 0 ? "over-allocated" : "unallocated"} against the contract sum.`
            : "Stage values have to stay within the project's contract sum."}
        </p>
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
          className="accent-primary-500"
        />
      </div>
    </FormDrawer>
  );
}

UpsertStageDialog.displayName = "UpsertStageDialog";

export { UpsertStageDialog };
