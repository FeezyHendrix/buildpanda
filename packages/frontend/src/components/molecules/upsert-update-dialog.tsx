import { useEffect, useState } from "react";
import { FormDrawer } from "./form-drawer";
import { MediaDropzone } from "./media-dropzone";
import { Select, type SelectOption } from "@/components/atoms/select";
import { TextInput } from "@/components/atoms/text-input";
import { useUploadFile } from "@/hooks/use-files";
import type { MediaType, UpdateCategory } from "@/lib/project-types";
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

const CATEGORY_OPTIONS: SelectOption[] = CATEGORIES.map((c) => ({
  value: c,
  label: c,
}));

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

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
  const [category, setCategory] = useState<UpdateCategory | null>(
    initial?.category ?? null,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<UpsertUpdateMedia[]>([]);
  const uploadFile = useUploadFile();

  useEffect(() => {
    if (open) {
      setCategory(initial?.category ?? null);
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setMedia(initial?.media ?? []);
    }
  }, [open, initial]);

  const isValid =
    category !== null && title.trim().length > 0 && description.trim().length > 0;

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const uploaded = await uploadFile.mutateAsync({ file, projectId });
      const type: MediaType = file.type.startsWith("video") ? "video" : "photo";
      setMedia((prev) => [
        ...prev,
        { type, url: `${API_BASE}/files/${uploaded.id}/view` },
      ]);
    }
  }

  function removeMedia(index: number): void {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(): void {
    if (!isValid || !category) return;
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
      title={mode === "create" ? "New Update" : "Edit update"}
      description={
        mode === "create"
          ? "Post a progress report, delivery note, inspection or issue from site"
          : "Update the category, details or photos of this report."
      }
      submitLabel={mode === "create" ? "Post Update" : "Save changes"}
      submitDisabled={!isValid || uploadFile.isPending}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
      footerVariant="stacked"
    >
      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-medium leading-none text-[#1E1E1E]">
          Category
        </p>
        <Select
          id="update-category"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(v) => setCategory(v as UpdateCategory | null)}
          placeholder="Select category"
        />
      </div>

      {/* Title */}
      <TextInput
        label="Title"
        value={title}
        onChange={setTitle}
        placeholder="e.g Reinforcements delivered on site"
        maxLength={200}
        autoFocus
      />

      {/* Details */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="update-description"
          className="text-[13px] font-medium leading-none text-[#1E1E1E]"
        >
          Details
        </label>
        <textarea
          id="update-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what happened on site."
          maxLength={2000}
          rows={5}
          className={cn(
            "min-h-[118px] w-full resize-none border-[0.5px] border-border bg-white px-3.5 py-3 text-caption-l text-black-500 placeholder:text-[#B0B0B0] outline-none transition-colors",
            "focus:border-black-500 focus:ring-1 focus:ring-black-500/10",
          )}
        />
      </div>

      {/* Photos & Videos */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] font-medium leading-none text-[#1E1E1E]">
          Photos & Videos{" "}
          <span className="font-normal text-[#B0B0B0]">(optional)</span>
        </p>

        <MediaDropzone
          onFiles={handleFiles}
          accept="image/jpeg,image/png,image/jpg,video/mp4,video/*,image/*"
          hint="MP4, JPG or PNG (max. 10MB)"
          disabled={uploadFile.isPending}
        />

        {media.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {media.map((item, index) => (
              <div
                key={`${item.url}-${index}`}
                className="group relative aspect-square overflow-hidden border border-[#EBEBEB] bg-[#F6F6F6]"
              >
                {item.type === "video" ? (
                  <div className="flex size-full items-center justify-center text-xs font-medium text-[#767676]">
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
                  className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove media"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadFile.isPending && (
          <p className="text-xs text-[#767676]">Uploading…</p>
        )}
      </div>
    </FormDrawer>
  );
}

UpsertUpdateDialog.displayName = "UpsertUpdateDialog";

export { UpsertUpdateDialog };
