import { useEffect, useState } from "react";
import { Select } from "@/components/atoms/select";
import { TextInput } from "@/components/atoms/text-input";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { Spinner } from "@/components/atoms/spinner";
import { FormDrawer } from "./form-drawer";
import { MediaDropzone } from "./media-dropzone";
import type { DocumentCategory } from "@/lib/project-types";

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DocumentCategory[];
  onSubmit: (input: { categoryId: string; file: File }) => void;
  onCreateCategory?: (name: string) => string;
  isSubmitting?: boolean;
  progress?: number | null;
  error?: string | null;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function GoBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 self-start text-sm font-medium text-[#111827] hover:underline"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
      Go Back
    </button>
  );
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  categories,
  onSubmit,
  onCreateCategory,
  isSubmitting = false,
  progress = null,
  error,
}: UploadDocumentDialogProps) {
  const [view, setView] = useState<"form" | "addCategory">("form");
  const [categoryId, setCategoryId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    if (!open) {
      setView("form");
      setCategoryId("");
      setFile(null);
      setFileError(null);
      setNewCategoryName("");
    }
  }, [open]);

  const isValid = categoryId.length > 0 && file !== null;
  const hasPercent = typeof progress === "number";
  const isFinalizing = isSubmitting && (!hasPercent || progress >= 100);
  const statusLabel = isFinalizing
    ? "Finalizing…"
    : `Uploading… ${hasPercent ? progress : 0}%`;

  function handleFiles(files: FileList): void {
    const picked = files[0];
    if (!picked) return;
    if (picked.size > MAX_FILE_BYTES) {
      setFile(null);
      setFileError("File is too large. Maximum size is 10MB.");
      return;
    }
    setFileError(null);
    setFile(picked);
  }

  function handleSubmit(): void {
    if (!file || !categoryId) return;
    onSubmit({ categoryId, file });
  }

  function handleCreateCategory(): void {
    const name = newCategoryName.trim();
    if (!name || !onCreateCategory) return;
    const id = onCreateCategory(name);
    setCategoryId(id);
    setNewCategoryName("");
    setView("form");
  }

  if (view === "addCategory") {
    return (
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Add Category"
        description=""
        submitLabel="Save"
        submitDisabled={!newCategoryName.trim()}
        onSubmit={handleCreateCategory}
        footerVariant="stacked"
      >
        <GoBackButton onClick={() => setView("form")} />
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[#1E1E1E]">
            Category
          </label>
          <TextInput
            value={newCategoryName}
            onChange={setNewCategoryName}
            placeholder="Legal"
            autoFocus
          />
        </div>
      </FormDrawer>
    );
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Upload Document"
      description="Pick a category and choose a file. Size and filename are read automatically."
      submitLabel="Upload"
      submitDisabled={!isValid}
      submitting={isSubmitting}
      error={error ?? fileError ?? null}
      onSubmit={handleSubmit}
      footerVariant="stacked"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="document-category" className="text-[13px] font-medium text-[#1E1E1E]">
            Category
          </label>
          {onCreateCategory && (
            <button
              type="button"
              onClick={() => setView("addCategory")}
              className="text-xs font-medium text-[#004DE7] hover:underline"
            >
              + Add Category
            </button>
          )}
        </div>
        <Select
          id="document-category"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={categoryId || null}
          onChange={(v) => setCategoryId(v ?? "")}
          placeholder="Select a category"
          disabled={isSubmitting}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-medium text-[#1E1E1E]">File</p>
        <MediaDropzone
          multiple={false}
          hint="(max. 10MB)"
          onFiles={handleFiles}
          disabled={isSubmitting}
        />
        {file && (
          <div className="flex items-center justify-between gap-2 border border-[#EBEBEB] bg-white px-3 py-2">
            <p className="min-w-0 truncate text-[13px] text-[#1E1E1E]">
              {file.name}{" "}
              <span className="text-xs text-[#9CA3AF]">
                · {formatFileSize(file.size)}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setFile(null)}
              aria-label="Remove selected file"
              disabled={isSubmitting}
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] outline-none hover:bg-[#F5F5F5] hover:text-[#1E1E1E] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}

        {isSubmitting && (
          <div className="flex flex-col gap-2 border border-[#E4E9F5] bg-[#F5F8FF] px-3 py-3">
            <div className="flex items-center gap-2.5">
              <Spinner size="sm" label={statusLabel} />
              <p className="text-sm font-medium text-[#111827]">{statusLabel}</p>
            </div>
            <ProgressBar value={hasPercent ? progress : isFinalizing ? 100 : 0} size="md" />
          </div>
        )}
      </div>
    </FormDrawer>
  );
}

UploadDocumentDialog.displayName = "UploadDocumentDialog";

export { UploadDocumentDialog, type UploadDocumentDialogProps };
