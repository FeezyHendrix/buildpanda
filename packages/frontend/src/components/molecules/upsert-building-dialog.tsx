import { useEffect, useState } from "react";
import { Select } from "@/components/atoms/select";
import { TextInput } from "@/components/atoms/text-input";
import { FormDialog } from "./form-dialog";
import type { BuildingStatus } from "@/api/buildings";

export interface UpsertBuildingValues {
  name: string;
  code?: string;
  status: BuildingStatus;
  progressPercent: number;
}

interface UpsertBuildingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertBuildingValues>;
  onSubmit: (values: UpsertBuildingValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const STATUS_OPTIONS: { value: BuildingStatus; label: string }[] = [
  { value: "planned", label: "Planned" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On hold" },
];

const LABEL_CLASS = "text-caption-m! font-semibold text-[#1E1E1E]";

/** Fill and track are painted on the input itself; the thumb is a thin tick at the current value. */
const PROGRESS_INPUT_CLASS = [
  "h-2 w-full cursor-pointer appearance-none rounded-none outline-none",
  "[&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:w-0.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-[#1E1E1E]",
  "[&::-moz-range-thumb]:h-2 [&::-moz-range-thumb]:w-0.5 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#1E1E1E]",
  "focus-visible:ring-2 focus-visible:ring-gray-900/10",
].join(" ");

export function UpsertBuildingDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertBuildingDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  // A new building starts with no status chosen; an edit starts from the saved one.
  const [status, setStatus] = useState<BuildingStatus | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setCode(initial?.code ?? "");
      setStatus(initial?.status ?? null);
      setProgress(initial?.progressPercent ?? 0);
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!name.trim() || !status) return;
    onSubmit({
      name: name.trim(),
      code: code.trim() || undefined,
      status,
      progressPercent: Math.max(0, Math.min(100, Math.round(progress))),
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Add building" : "Edit building"}
      description="Manage buildings within your project."
      submitLabel={mode === "create" ? "Add Building" : "Save changes"}
      submitDisabled={!name.trim() || !status}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      footerVariant="stacked"
      size="roomy"
      className="w-[min(462px,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="building-progress" className="text-caption-l! font-medium text-[#1E1E1E]">
          Progress
        </label>
        <div className="flex items-center gap-4">
          <input
            id="building-progress"
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className={PROGRESS_INPUT_CLASS}
            style={{ background: `linear-gradient(to right, #004DE7 ${progress}%, #E5E5E5 ${progress}%)` }}
          />
          <span className="w-9 shrink-0 text-caption-l! font-medium text-[#1E1E1E]">{progress}%</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="building-name" className={LABEL_CLASS}>
          Building Name
        </label>
        <TextInput
          id="building-name"
          value={name}
          onChange={setName}
          placeholder="e.g. Tower A"
          className="h-[46px] px-4"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="building-code" className="text-caption-l! font-medium text-[#1E1E1E]">
          Code <span className="font-normal text-[#B0B0B0]">(optional)</span>
        </label>
        <TextInput
          id="building-code"
          value={code}
          onChange={setCode}
          placeholder="e.g. T-A"
          className="h-[46px] px-4"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="building-status" className={LABEL_CLASS}>
          Status
        </label>
        <Select
          id="building-status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(next) => setStatus(next as BuildingStatus | null)}
          placeholder="Select status"
          className="h-[46px] px-4 text-caption-l!"
        />
      </div>
    </FormDialog>
  );
}
