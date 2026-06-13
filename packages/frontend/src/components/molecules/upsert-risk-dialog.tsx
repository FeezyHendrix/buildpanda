import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import type { RiskLevel } from "@/lib/project-types";

export interface UpsertRiskValues {
  title: string;
  description: string;
  severity: RiskLevel;
}

interface UpsertRiskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: UpsertRiskValues;
  onSubmit: (values: UpsertRiskValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const SEVERITIES: RiskLevel[] = ["Low", "Medium", "High"];

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertRiskDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertRiskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<RiskLevel>("Medium");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setSeverity(initial?.severity ?? "Medium");
    }
  }, [open, initial]);

  const isValid = title.trim().length > 0 && description.trim().length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      severity,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New risk factor" : "Edit risk factor"}
      description={
        mode === "create"
          ? "Log a risk on this project so the team can track and mitigate it."
          : "Update the details or severity of this risk factor."
      }
      submitLabel={mode === "create" ? "Add risk" : "Save changes"}
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="risk-title">Title</Label>
        <input
          id="risk-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Foundation rebar delivery delayed"
          maxLength={200}
          autoFocus
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="risk-description">Description</Label>
        <textarea
          id="risk-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the risk and its potential impact on the project…"
          maxLength={2000}
          rows={4}
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="risk-severity">Severity</Label>
        <select
          id="risk-severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as RiskLevel)}
          className={inputClass}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </FormDrawer>
  );
}

export { UpsertRiskDialog };
