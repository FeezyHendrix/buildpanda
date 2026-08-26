import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MediaDropzoneProps {
  accept?: string;
  multiple?: boolean;
  hint?: string;
  onFiles: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
  height?: number;
}

export function MediaDropzone({
  accept = "image/*,video/*",
  multiple = true,
  hint = "MP4, JPG or PNG (max. 10MB)",
  onFiles,
  disabled = false,
  className,
  height = 132,
}: MediaDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) onFiles(e.target.files);
    // reset so same file can be selected again
    e.target.value = "";
  }

  function handleDragOver(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ height }}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 border border-dashed bg-white px-4 outline-none transition-colors",
        "focus-visible:border-[#004DE7] focus-visible:ring-1 focus-visible:ring-[#004DE7]/10",
        disabled && "cursor-not-allowed opacity-60",
        isDragging
          ? "border-[#004DE7] bg-[#EEF3FF]"
          : "border-[#E5E5E5] hover:border-[#C8C8C8] hover:bg-[#FAFAFA]",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-[#F6F6F6]">
        <Upload className="size-5 text-black-500" />
      </span>

      <span className="flex flex-col items-center gap-0.5">
        <span className="text-[13px] leading-5">
          <span className="font-semibold text-[#1E1E1E]">Click to upload</span>{" "}
          <span className="font-normal text-[#767676]">or drag and drop</span>
        </span>
        {hint && <span className="text-xs font-normal text-[#B0B0B0]">{hint}</span>}
      </span>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
        tabIndex={-1}
      />
    </button>
  );
}

MediaDropzone.displayName = "MediaDropzone";
