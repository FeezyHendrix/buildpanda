import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

export interface UpsertApprovalValues {
  title: string;
  category: string | null;
  description: string | null;
  dueDate: string | null;
  requestedReviewerId: string | null;
}

export interface ReviewerOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: Partial<UpsertApprovalValues>;
  reviewerOptions?: ReviewerOption[];
  onSubmit: (values: UpsertApprovalValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const CATEGORIES = ["Finishes", "Fittings", "Materials", "Structural", "Other"];

const field = INPUT_CLASS;

function UpsertApprovalDialog({
  open,
  onOpenChange,
  mode,
  initial,
  reviewerOptions = [],
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Finishes");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [requestedReviewerId, setRequestedReviewerId] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setCategory(initial?.category ?? "Finishes");
      setDescription(initial?.description ?? "");
      setDueDate(initial?.dueDate ?? "");
      setRequestedReviewerId(initial?.requestedReviewerId ?? "");
    }
  }, [open, initial]);

  function handleSubmit(): void {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      category: category || null,
      description: description.trim() || null,
      dueDate: dueDate || null,
      requestedReviewerId: requestedReviewerId || null,
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
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ap-reviewer">Request approval from</Label>
        <select
          id="ap-reviewer"
          value={requestedReviewerId}
          onChange={(e) => setRequestedReviewerId(e.target.value)}
          className={field}
        >
          <option value="">Anyone who can approve (clients & team)</option>
          {reviewerOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400">
          Pick a person to send this to them specifically; otherwise clients and other approvers can sign off.
        </p>
      </div>
    </FormDrawer>
  );
}

UpsertApprovalDialog.displayName = "UpsertApprovalDialog";

export { UpsertApprovalDialog };
