import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "./form-drawer";
import { cn } from "@/lib/utils";
import type { DocumentCategory } from "@/lib/project-types";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DocumentCategory[];
  onSubmit: (input: { categoryId: string; file: File }) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  categories,
  onSubmit,
  isSubmitting = false,
  error,
}: UploadDocumentDialogProps) {
  const [categoryId, setCategoryId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setCategoryId("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  const isValid = categoryId.length > 0 && file !== null;

  function handleSubmit(): void {
    if (!file || !categoryId) return;
    onSubmit({ categoryId, file });
  }

  return (
    <FormDrawer open={open}
    onOpenChange={onOpenChange}
    title="Upload document"
    description="Pick a category and choose a file. Size and filename are read automatically."
    submitLabel="Upload"
    submitDisabled={!isValid}
    submitting={isSubmitting}
    error={error ?? null}
    onSubmit={handleSubmit}><div className="flex flex-col gap-1.5">
      <Label htmlFor="document-category">Category</Label>
      <select
        id="document-category"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
      >
        <option value="">Select a category</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
    
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="document-file">File</Label>
      <input
        ref={fileInputRef}
        id="document-file"
        type="file"
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null;
          setFile(picked);
        }}
        className="sr-only"
      />
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border-2 border-dashed border-[#D9D9D9] bg-[#FAFAFA] px-3 py-3",
          file && "border-[#004DE7]/30 bg-[#F5F8FF]",
        )}
      >
        <div className="min-w-0">
          {file ? (
            <>
              <p className="truncate text-sm font-medium text-gray-900">
                {file.name}
              </p>
              <p className="text-[11px] text-gray-500">
                {(file.size / 1024).toFixed(1)} KB · {file.type || "Unknown type"}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">No file selected</p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-9 px-3 text-xs"
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? "Replace" : "Choose file"}
        </Button>
      </div>
    </div></FormDrawer>
  );
}

UploadDocumentDialog.displayName = "UploadDocumentDialog";

export { UploadDocumentDialog, type UploadDocumentDialogProps };
