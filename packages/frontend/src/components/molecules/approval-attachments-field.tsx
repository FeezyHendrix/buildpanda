import { useState } from "react";
import { ReactSVG } from "react-svg";
import { X } from "lucide-react";
import { getFileTypeIcon } from "@/lib/file-type-icon";
import { MediaDropzone } from "./media-dropzone";

export const MAX_APPROVAL_ATTACHMENTS = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf";
const ALLOWED = /\.(png|jpe?g|pdf)$/i;

interface ApprovalAttachmentsFieldProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Up to five PNG, JPG or PDF files, picked or dropped, on the shared
 * MediaDropzone. Picked files show as removable chips inside the same dashed
 * box; anything refused (wrong type, too large, over the limit) is named under
 * it rather than dropped silently.
 */
export function ApprovalAttachmentsField({ files, onChange, disabled = false }: ApprovalAttachmentsFieldProps) {
  const [problem, setProblem] = useState<string | null>(null);

  function addFiles(incoming: FileList): void {
    const accepted: File[] = [];
    const refused: string[] = [];
    for (const file of Array.from(incoming)) {
      if (!ALLOWED.test(file.name)) refused.push(`${file.name} is not a PNG, JPG or PDF`);
      else if (file.size > MAX_FILE_BYTES) refused.push(`${file.name} is over 10MB`);
      else if (files.length + accepted.length >= MAX_APPROVAL_ATTACHMENTS) refused.push(`${file.name} would exceed ${MAX_APPROVAL_ATTACHMENTS} files`);
      else accepted.push(file);
    }
    if (accepted.length > 0) onChange([...files, ...accepted]);
    setProblem(refused.length > 0 ? `${refused.join(". ")}.` : null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-caption-m! font-semibold text-[#1E1E1E]">
        Attachments{" "}
        <span className="font-normal text-gray-500">(Click to upload, Max {MAX_APPROVAL_ATTACHMENTS} uploads)</span>
      </p>
      <MediaDropzone
        accept={ACCEPT}
        multiple
        height={122}
        disabled={disabled}
        onFiles={addFiles}
        prompt={null}
        hint="PNG, JPG or PDF only"
        hintClassName="text-caption-m! text-gray-500"
        iconClassName="bg-[#E4ECFF] text-primary"
        className="border-[#767676] hover:border-[#767676]"
      >
        {files.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex h-9 items-center gap-2 bg-white px-3 text-caption-l! font-medium text-[#1E1E1E]">
                <ReactSVG src={getFileTypeIcon(file.name)} className="shrink-0 [&_svg]:size-5" />
                <span className="max-w-[200px] truncate" title={file.name}>
                  {file.name}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  disabled={disabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(files.filter((_, i) => i !== index));
                    setProblem(null);
                  }}
                  className="flex size-4 items-center justify-center text-[#1E1E1E] hover:text-error-600"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : undefined}
      </MediaDropzone>
      {problem ? (
        <p role="alert" className="text-caption-m! text-error-600">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

ApprovalAttachmentsField.displayName = "ApprovalAttachmentsField";
