import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";

export interface UpsertApprovalValues {
  title: string;
  category: string | null;
  description: string | null;
  dueDate: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertApprovalValues>;
  onSubmit: (values: UpsertApprovalValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const CATEGORIES = ["Finishes", "Fittings", "Materials", "Structural", "Other"];

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertApprovalDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Finishes");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setCategory(initial?.category ?? "Finishes");
      setDescription(initial?.description ?? "");
      setDueDate(initial?.dueDate ?? "");
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      category: category || null,
      description: description.trim() || null,
      dueDate: dueDate || null,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Submit for approval" : "Edit approval"}
      description="Submit a selection or specification for sign-off."
      submitLabel={mode === "create" ? "Submit" : "Save changes"}
      submitDisabled={!title.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ap-title">Title</Label>
        <input
          id="ap-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Living room tile selection"
          className={field}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-category">Category</Label>
          <select id="ap-category" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ap-due">Needed by</Label>
          <input id="ap-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ap-desc">Details</Label>
        <textarea
          id="ap-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe what's being submitted for approval"
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDrawer>
  );
}

UpsertApprovalDialog.displayName = "UpsertApprovalDialog";

export { UpsertApprovalDialog };
