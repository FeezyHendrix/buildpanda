import { useEffect, useState } from "react";
import { FormDialog } from "./form-dialog";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";
import type { InspectionCategory } from "@/lib/project-mock-data";

type ApiInspectionCategory = Exclude<InspectionCategory, "All Reports">;

const CATEGORIES: ApiInspectionCategory[] = [
  "Structural",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
];

export interface RequestInspectionInput {
  title: string;
  category: ApiInspectionCategory;
  description: string;
  scheduledAt: string;
}

interface RequestInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: RequestInspectionInput) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function RequestInspectionDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  error,
}: RequestInspectionDialogProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ApiInspectionCategory>("Structural");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      setCategory("Structural");
      setDescription("");
      setScheduledAt("");
    }
  }, [open]);

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    scheduledAt.trim().length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      title: title.trim(),
      category,
      description: description.trim(),
      scheduledAt: scheduledAt.trim(),
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Request a new inspection"
      submitLabel="Request inspection"
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
          autoFocus
          maxLength={200}
          placeholder="e.g. Foundation strength check"
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Category</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                "h-9 rounded-full px-3.5 text-xs font-medium transition-colors",
                category === cat
                  ? "bg-[#004DE7] text-white"
                  : "bg-[#F6F6F6] text-gray-700 hover:bg-[#EDEDED]",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-description">What needs inspecting?</Label>
        <textarea
          id="inspection-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Scope of the inspection, areas to check, any concerns."
          className="resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inspection-date">Preferred date</Label>
        <input
          id="inspection-date"
          type="date"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDialog>
  );
}

RequestInspectionDialog.displayName = "RequestInspectionDialog";

export { RequestInspectionDialog, type RequestInspectionDialogProps };
