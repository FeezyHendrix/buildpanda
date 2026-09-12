import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import uploaderIcon from "@/assets/icons/uploader-icon.svg";

interface FileUploadProps {
  label?: string;
  optional?: boolean;
  height?: number;
  accept?: string;
  hint?: string;
  multiple?: boolean;
  onChange?: (files: FileList | null) => void;
  className?: string;
}

function FileUpload({
  label,
  optional = false,
  height = 300,
  accept,
  hint = "PDF, JPG or PNG (max. 10MB)",
  multiple = false,
  onChange,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.files);
  };

  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragging(false);
    onChange?.(e.dataTransfer.files);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <p className="text-sm font-medium text-ink">
          {label}
          {optional && (
            <span className="font-normal text-ink-muted"> (Optional)</span>
          )}
        </p>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ height }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#C8C8C8]",
          "outline-none transition-colors",
          "focus-visible:shadow-focus",
          isDragging
            ? "border-primary-500 bg-blue-50"
            : "hover:border-gray-400 hover:bg-gray-50",
        )}
      >
        <img
          src={uploaderIcon}
          alt=""
          aria-hidden="true"
          className="size-[100px]"
        />

        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-primary-500">
              Click to upload
            </span>{" "}
            or drag and drop
          </p>
          {hint && (
            <p className="text-xs text-ink-muted">{hint}</p>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
      </button>
    </div>
  );
}

FileUpload.displayName = "FileUpload";

export { FileUpload, type FileUploadProps };
