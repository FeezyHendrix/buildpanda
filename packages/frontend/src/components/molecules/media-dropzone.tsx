import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
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
  /** Replaces the "Click to upload or drag and drop" line; `null` leaves only the hint. */
  prompt?: ReactNode;
  /** Classes for the round icon badge (e.g. a brand-tinted circle). */
  iconClassName?: string;
  /** Classes for the hint line under the prompt. */
  hintClassName?: string;
  /**
   * Content shown inside the box in place of the icon and text, e.g. chips for
   * the files already picked. The box then grows from `height` as a minimum and
   * stays clickable and droppable.
   */
  children?: ReactNode;
}

export function MediaDropzone({
  accept,
  multiple = true,
  hint,
  onFiles,
  disabled = false,
  className,
  height = 132,
  prompt,
  iconClassName,
  hintClassName,
  children,
}: MediaDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) onFiles(e.target.files);
    // reset so same file can be selected again
    e.target.value = "";
  }

  function handleDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
  }

  function open(): void {
    if (!disabled) inputRef.current?.click();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>): void {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  }

  const hasChildren = children !== undefined && children !== null;

  // A div, not a button: the picked-file chips inside carry their own buttons.
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onClick={open}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={hasChildren ? { minHeight: height } : { height }}
      className={cn(
        "flex w-full cursor-pointer flex-col border border-dashed outline-none transition-colors",
        hasChildren ? "items-start gap-2 bg-[#F5F5F5] p-4" : "items-center justify-center gap-3 bg-white px-4",
        "focus-visible:border-[#004DE7] focus-visible:ring-1 focus-visible:ring-[#004DE7]/10",
        disabled && "cursor-not-allowed opacity-60",
        isDragging
          ? "border-[#004DE7] bg-[#EEF3FF]"
          : "border-[#E5E5E5] hover:border-[#C8C8C8] hover:bg-[#FAFAFA]",
        className,
      )}
    >
      {hasChildren ? (
        children
      ) : (
        <>
          <span className={cn("flex size-10 items-center justify-center rounded-full bg-[#F6F6F6] text-black-500", iconClassName)}>
            <Upload className="size-5" />
          </span>

          <span className="flex flex-col items-center gap-0.5">
            {prompt === null ? null : (
              <span className="text-[13px] leading-5">
                {prompt ?? (
                  <>
                    <span className="font-semibold text-[#1E1E1E]">Click to upload</span>{" "}
                    <span className="font-normal text-[#767676]">or drag and drop</span>
                  </>
                )}
              </span>
            )}
            {hint && <span className={cn("text-xs font-normal text-[#B0B0B0]", hintClassName)}>{hint}</span>}
          </span>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
        tabIndex={-1}
      />
    </div>
  );
}

MediaDropzone.displayName = "MediaDropzone";
