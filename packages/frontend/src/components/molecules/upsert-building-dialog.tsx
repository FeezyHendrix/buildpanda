import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
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
  { value: "on_hold", label: "On Hold" },
];

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

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
  const [status, setStatus] = useState<BuildingStatus>("planned");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setCode(initial?.code ?? "");
      setStatus(initial?.status ?? "planned");
      setProgress(initial?.progressPercent ?? 0);
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      code: code.trim() || undefined,
      status,
      progressPercent: Math.max(0, Math.min(100, Math.round(progress))),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Add building" : "Edit building"}
      description="Manage buildings within your project."
      submitLabel={mode === "create" ? "Add building" : "Save changes"}
      submitDisabled={!name.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="building-name">Building name</Label>
        <input
          id="building-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tower A"
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="building-code">Code (Optional)</Label>
        <input
          id="building-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. T-A"
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="building-status">Status</Label>
        <select
          id="building-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as BuildingStatus)}
          className={field}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="building-progress">Progress</Label>
          <span className="text-xs text-gray-500">{progress}%</span>
        </div>
        <input
          id="building-progress"
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          className="accent-gray-900"
        />
      </div>
    </FormDrawer>
  );
}
