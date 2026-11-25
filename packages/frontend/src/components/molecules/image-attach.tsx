import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { cn } from "@/lib/utils";

/** A picked file as a blue paperclip link, with an optional remove. */
export function FileLink({ file, onRemove }: { file: File; onRemove?: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-[6px] text-caption-l text-[#004DE7]">
      <Paperclip className="size-[14px] shrink-0" aria-hidden />
      <span className="truncate">{file.name}</span>
      {onRemove ? (
        <button type="button" aria-label={`Remove ${file.name}`} onClick={onRemove} className="shrink-0 text-[#737373] hover:text-[#1E1E1E]">
          <X className="size-[14px]" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

/** "Add Image": opens the picker; the chosen files are handed back to the form. */
export function AddImageButton({ onFiles, className }: { onFiles: (files: File[]) => void; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "inline-flex h-[46px] shrink-0 items-center gap-[9px] border border-[#E0E0E0] bg-white px-[15px] text-caption-l font-semibold text-[#1E1E1E] outline-none transition-colors hover:bg-[#F6F6F6] focus-visible:ring-2 focus-visible:ring-[#004DE7]/25",
          className,
        )}
      >
        <ReactSVG src={icons2.image} className="flex [&_svg]:size-[18px]" aria-hidden />
        Add Image
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        tabIndex={-1}
        onChange={(event) => {
          if (event.target.files) onFiles(Array.from(event.target.files));
          event.target.value = "";
        }}
      />
    </>
  );
}
