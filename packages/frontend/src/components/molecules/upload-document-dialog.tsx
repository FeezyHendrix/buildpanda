import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { ProgressBar } from "@/components/atoms/progress-bar";
import { Spinner } from "@/components/atoms/spinner";
import { FormDrawer } from "./form-drawer";
import { cn } from "@/lib/utils";
import type { DocumentCategory, DocumentVisibility, ProjectDocument } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";

export interface UploadDocumentInput {
  categoryId: string;
  file: File;
  title: string | null;
  revision: string | null;
  supersedesId: string | null;
  visibility: DocumentVisibility;
  documentDate: string | null;
}

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DocumentCategory[];
  /** Existing documents, so a new revision can name the one it supersedes. */
  documents?: ProjectDocument[];
  onSubmit: (input: UploadDocumentInput) => void;
  isSubmitting?: boolean;
  progress?: number | null;
  error?: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  categories,
  documents = [],
  onSubmit,
  isSubmitting = false,
  progress = null,
  error,
}: UploadDocumentDialogProps) {
  const [categoryId, setCategoryId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [revision, setRevision] = useState("");
  const [supersedesId, setSupersedesId] = useState("");
  const [visibility, setVisibility] = useState<DocumentVisibility>("internal");
  const [documentDate, setDocumentDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setCategoryId("");
      setFile(null);
      setTitle("");
      setRevision("");
      setSupersedesId("");
      setVisibility("internal");
      setDocumentDate("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  const isValid = categoryId.length > 0 && file !== null;
  const hasPercent = typeof progress === "number";
  const isFinalizing = isSubmitting && (!hasPercent || progress >= 100);
  const statusLabel = isFinalizing
    ? "Finalizing…"
    : `Uploading… ${hasPercent ? progress : 0}%`;

  function handleSubmit(): void {
    if (!file || !categoryId) return;
    onSubmit({
      categoryId,
      file,
      title: title.trim() || null,
      revision: revision.trim() || null,
      supersedesId: supersedesId || null,
      visibility,
      documentDate: documentDate || null,
    });
  }

  return (
    <FormDrawer open={open}
    onOpenChange={onOpenChange}
    title="Upload document"
    description="A register needs more than a filename: give the document a title and a revision so the next issue can supersede it."
    width="lg"
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
        disabled={isSubmitting}
        className={INPUT_CLASS}
      >
        <option value="">Select a category</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
    
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-title">Title</Label>
        <input
          id="document-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          disabled={isSubmitting}
          placeholder="e.g. Typical cross-section, ch 0+000 – 1+200"
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-revision">Revision</Label>
        <input
          id="document-revision"
          value={revision}
          onChange={(e) => setRevision(e.target.value)}
          maxLength={50}
          disabled={isSubmitting}
          placeholder="e.g. Rev C"
          className={INPUT_CLASS}
        />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-date">Date on the document</Label>
        <input
          id="document-date"
          type="date"
          value={documentDate}
          onChange={(e) => setDocumentDate(e.target.value)}
          disabled={isSubmitting}
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-visibility">Visibility</Label>
        <select
          id="document-visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as DocumentVisibility)}
          disabled={isSubmitting}
          className={INPUT_CLASS}
        >
          <option value="internal">Internal — the delivery team only</option>
          <option value="shared">Issued to the client</option>
        </select>
      </div>
    </div>

    {documents.length > 0 ? (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-supersedes">Supersedes</Label>
        <select
          id="document-supersedes"
          value={supersedesId}
          onChange={(e) => setSupersedesId(e.target.value)}
          disabled={isSubmitting}
          className={INPUT_CLASS}
        >
          <option value="">Nothing — this is a new document</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.title ?? doc.fileName}
              {doc.revision ? ` · ${doc.revision}` : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          The superseded document stays on file; the register shows the chain.
        </p>
      </div>
    ) : null}

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
          "flex items-center justify-between gap-3 rounded-lg border-2 border-dashed border-line bg-surface-alt px-3 py-3",
          file && "border-primary-500/30 bg-primary-50",
        )}
      >
        <div className="min-w-0">
          {file ? (
            <>
              <p className="truncate text-sm font-medium text-gray-900">
                {file.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatBytes(file.size)} · {file.type || "Unknown type"}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">No file selected</p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          loading={isSubmitting}
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? "Replace" : "Choose file"}
        </Button>
      </div>

      {isSubmitting && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-3">
          <div className="flex items-center gap-2.5">
            <Spinner size="sm" label={statusLabel} />
            <p className="text-sm font-medium text-gray-900">{statusLabel}</p>
          </div>
          <ProgressBar
            value={hasPercent ? progress : isFinalizing ? 100 : 0}
            size="md"
          />
        </div>
      )}
    </div></FormDrawer>
  );
}

UploadDocumentDialog.displayName = "UploadDocumentDialog";

export { UploadDocumentDialog, type UploadDocumentDialogProps };
