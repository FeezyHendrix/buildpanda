import { useEffect, useRef, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { Label } from "@/components/atoms/label";
import { useUploadFile } from "@/hooks/use-files";
import { Button } from "@/components/atoms/button";
import { errorMessage, isStorageUnavailable } from "@/lib/api-error";
import type { MediaType, UpdateCategory } from "@/lib/project-types";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

export interface UpsertUpdateMedia {
  type: MediaType;
  url: string;
}

export interface UpsertUpdateValues {
  category: UpdateCategory;
  title: string;
  description: string;
  media: UpsertUpdateMedia[];
}

interface UpsertUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  projectId: string;
  initial?: UpsertUpdateValues;
  onSubmit: (values: UpsertUpdateValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const CATEGORIES: UpdateCategory[] = [
  "Progress",
  "Material Delivery",
  "Inspections",
  "Issues",
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

const inputClass = INPUT_CLASS;

function UpsertUpdateDialog({
  open,
  onOpenChange,
  mode,
  projectId,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: UpsertUpdateDialogProps) {
  const [category, setCategory] = useState<UpdateCategory>("Progress");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<UpsertUpdateMedia[]>([]);
  // Names of files the user picked that could not be stored. The update is not
  // posted without them unless the user says so: an update that silently loses
  // its photos is a lie to the client (finding F51).
  const [failedUploads, setFailedUploads] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [postWithoutMedia, setPostWithoutMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFile = useUploadFile();

  useEffect(() => {
    if (open) {
      setCategory(initial?.category ?? "Progress");
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setMedia(initial?.media ?? []);
      setFailedUploads([]);
      setUploadError(null);
      setPostWithoutMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open, initial]);

  const isValid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    (failedUploads.length === 0 || postWithoutMedia);

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setUploadError(null);
    for (const file of Array.from(files)) {
      try {
        const uploaded = await uploadFile.mutateAsync({ file, projectId });
        const type: MediaType = file.type.startsWith("video") ? "video" : "photo";
        setMedia((prev) => [...prev, { type, url: `${API_BASE}/files/${uploaded.id}/download` }]);
        setFailedUploads((prev) => prev.filter((name) => name !== file.name));
      } catch (error) {
        // Keep the draft. The typed 503 from /files tells us it is the store,
        // not the file, so say so instead of "Internal server error".
        setFailedUploads((prev) => (prev.includes(file.name) ? prev : [...prev, file.name]));
        setUploadError(
          isStorageUnavailable(error)
            ? `${file.name} could not be uploaded — file storage is unavailable. Your text is kept; try again shortly.`
            : `${file.name} could not be uploaded — ${errorMessage(error)}`,
        );
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeMedia(index: number): void {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(): void {
    if (!isValid) return;
    onSubmit({
      category,
      title: title.trim(),
      description: description.trim(),
      media,
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New update" : "Edit update"}
      description={
        mode === "create"
          ? "Post a progress report, delivery note, inspection or issue from the site."
          : "Update the category, details or photos of this report."
      }
      submitLabel={mode === "create" ? "Post update" : "Save changes"}
      submitDisabled={!isValid || uploadFile.isPending}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="update-category">Category</Label>
        <select
          id="update-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as UpdateCategory)}
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
        <Label htmlFor="update-title">Title</Label>
        <input
          id="update-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Second floor slab poured"
          maxLength={200}
          autoFocus
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="update-description">Details</Label>
        <textarea
          id="update-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what happened on site…"
          maxLength={2000}
          rows={4}
          className={cn(INPUT_CLASS, "h-auto min-h-24 py-3")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="update-media">Photos &amp; videos</Label>
        {media.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {media.map((item, index) => (
              <div
                key={`${item.url}-${index}`}
                className="group relative aspect-square overflow-hidden rounded-lg bg-surface-alt"
              >
                {item.type === "video" ? (
                  <div className="flex size-full items-center justify-center text-xs font-medium text-gray-500">
                    Video
                  </div>
                ) : (
                  <img
                    src={item.url}
                    alt=""
                    className="size-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(index)}
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          id="update-media"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => void handleFiles(e.target.files)}
          className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-alt file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
        />
        {uploadFile.isPending ? <p className="text-xs text-gray-500">Uploading…</p> : null}

        {failedUploads.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg bg-negative-50 px-3 py-2.5">
            <p className="text-xs text-negative-600">{uploadError}</p>
            <p className="text-xs text-negative-600">
              Not uploaded: {failedUploads.join(", ")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Try the upload again
              </Button>
              <label className="flex items-center gap-2 text-xs text-negative-700">
                <input
                  type="checkbox"
                  checked={postWithoutMedia}
                  onChange={(event) => setPostWithoutMedia(event.target.checked)}
                />
                Post without {failedUploads.length === 1 ? "it" : "them"}
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </FormDrawer>
  );
}

UpsertUpdateDialog.displayName = "UpsertUpdateDialog";

export { UpsertUpdateDialog };
