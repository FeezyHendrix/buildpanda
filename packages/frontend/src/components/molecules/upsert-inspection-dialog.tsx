import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import type { InspectionCategory } from "@/lib/project-types";

export interface UpsertInspectionValues {
  title: string;
  category: Exclude<InspectionCategory, "All Reports">;
  description: string;
  scheduledAt: string;
  status: "Scheduled" | "Action Required" | "Completed";
  riskLevel: "Low" | "Medium" | "High";
}

interface UpsertInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "edit";
  initial?: UpsertInspectionValues;
  onSubmit: (values: UpsertInspectionValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const CATEGORIES: Exclude<InspectionCategory, "All Reports">[] = [
  "Structural",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
];

const STATUSES: ("Scheduled" | "Action Required" | "Completed")[] = [
  "Scheduled",
  "Action Required",
  "Completed",
];

const RISK_LEVELS: ("Low" | "Medium" | "High")[] = ["Low", "Medium", "High"];

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertInspectionDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertInspectionDialogProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Exclude<InspectionCategory, "All Reports">>("Structural");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState<"Scheduled" | "Action Required" | "Completed">("Scheduled");
  const [riskLevel, setRiskLevel] = useState<"Low" | "Medium" | "High">("Low");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setCategory(initial?.category ?? "Structural");
      setDescription(initial?.description ?? "");
      setScheduledAt(initial?.scheduledAt ?? "");
      setStatus(initial?.status ?? "Scheduled");
      setRiskLevel(initial?.riskLevel ?? "Low");
    }
  }, [open, initial]);

  const isValid = title.trim().length > 0 && description.trim().length > 0 && scheduledAt.trim().length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      title: title.trim(),
      category,
      description: description.trim(),
      scheduledAt: scheduledAt.trim(),
      status,
      riskLevel,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit inspection" : "Inspection"}
      description="Update the details or status of this inspection."
      submitLabel="Save changes"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-title">Title</Label>
        <input
          id="inspection-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Initial site assessment"
          maxLength={200}
          autoFocus
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-category">Category</Label>
        <select
          id="inspection-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as Exclude<InspectionCategory, "All Reports">)}
          className={inputClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-description">Description</Label>
        <textarea
          id="inspection-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the inspection findings or purpose…"
          maxLength={2000}
          rows={4}
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-scheduled">Scheduled Date</Label>
        <input
          id="inspection-scheduled"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          placeholder="YYYY-MM-DD"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-status">Status</Label>
        <select
          id="inspection-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "Scheduled" | "Action Required" | "Completed")}
          className={inputClass}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-risk">Risk Level</Label>
        <select
          id="inspection-risk"
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value as "Low" | "Medium" | "High")}
          className={inputClass}
        >
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </FormDrawer>
  );
}

export { UpsertInspectionDialog };
