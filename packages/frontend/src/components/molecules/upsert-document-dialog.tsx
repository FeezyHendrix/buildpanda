import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { useProjectDocumentCategories } from "@/hooks/use-documents";

export interface UpsertDocumentValues {
  categoryId: string;
}

interface UpsertDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  mode: "edit";
  initial?: UpsertDocumentValues;
  onSubmit: (values: UpsertDocumentValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const inputClass =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";

function UpsertDocumentDialog({
  open,
  onOpenChange,
  projectId,
  mode,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertDocumentDialogProps) {
  const [categoryId, setCategoryId] = useState("");
  const { data: categories = [] } = useProjectDocumentCategories(projectId);

  useEffect(() => {
    if (open) {
      setCategoryId(initial?.categoryId ?? "");
    }
  }, [open, initial]);

  const isValid = categoryId.trim().length > 0;

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      categoryId: categoryId.trim(),
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "edit" ? "Edit document category" : "Edit document"}
      description="Update the category of this document."
      submitLabel="Save changes"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-category">Category</Label>
        <select
          id="document-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Select a category...
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </FormDrawer>
  );
}

export { UpsertDocumentDialog };
