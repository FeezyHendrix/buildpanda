import type { ReactNode } from "react";
import { FileImage, FileText, X } from "lucide-react";
import { Spinner } from "@/components/atoms/spinner";
import { ToggleSwitch } from "@/components/atoms/toggle-switch";
import { DRAWER_LABEL_CLASS } from "@/components/molecules/drawer-fields";
import { MediaDropzone } from "@/components/molecules/media-dropzone";
import { PROOF_ACCEPT } from "@/lib/photo-proof";

/** A labelled upload box in the drawer: bold one-line prompt, grey hint, optional file chip. */
function ExpenseUploadField({
  label,
  optional,
  accept,
  prompt,
  hint,
  onFiles,
  problem,
  children,
}: {
  label: string;
  optional?: boolean;
  accept: string;
  prompt: string;
  hint: string;
  onFiles: (files: FileList) => void;
  problem?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[5px]">
      <span className={DRAWER_LABEL_CLASS}>
        {label}
        {optional ? <span className="font-normal text-[#737373]"> (optional)</span> : null}
      </span>
      <MediaDropzone
        accept={accept}
        multiple={false}
        height={122}
        onFiles={onFiles}
        className="gap-[8px]"
        prompt={<span className="text-caption-l font-semibold text-[#1E1E1E]">{prompt}</span>}
        hint={hint}
        hintClassName="text-caption-l leading-[18px] text-[#8A8A8A]"
      >
        {children}
      </MediaDropzone>
      {problem ? <p className="text-caption-m text-error-600">{problem}</p> : null}
    </div>
  );
}

ExpenseUploadField.displayName = "ExpenseUploadField";

/** The picked file as a row inside its dropzone: name, an optional link to view it, and remove. */
function FileChip({ name, icon, href, onRemove, removeLabel }: { name: string; icon: ReactNode; href?: string | null; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="flex w-full items-center gap-[10px] px-[16px]" onClick={(event) => event.stopPropagation()}>
      <span className="shrink-0 text-primary">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-caption-l text-[#1E1E1E]">{name}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="shrink-0 text-caption-m font-semibold text-[#004DE7] hover:underline">
          View
        </a>
      ) : null}
      <button type="button" aria-label={removeLabel} onClick={onRemove} className="shrink-0 text-[#737373] hover:text-[#1E1E1E]">
        <X className="size-[16px]" aria-hidden />
      </button>
    </div>
  );
}

FileChip.displayName = "FileChip";

interface ExpenseProofFieldProps {
  file: File | null;
  problem: string | null;
  onFiles: (files: FileList) => void;
  onClear: () => void;
}

/** Photo proof of the payment. Held on the form but not sent: the API has no field for it yet. */
export function ExpenseProofField({ file, problem, onFiles, onClear }: ExpenseProofFieldProps) {
  return (
    <ExpenseUploadField
      label="Photo proof"
      optional
      accept={PROOF_ACCEPT}
      prompt="Click to upload or drag and drop"
      hint="JPG or PNG (max. 10MB)"
      onFiles={onFiles}
      problem={problem}
    >
      {file ? <FileChip name={file.name} icon={<FileImage className="size-[18px]" aria-hidden />} onRemove={onClear} removeLabel="Remove photo proof" /> : undefined}
    </ExpenseUploadField>
  );
}

ExpenseProofField.displayName = "ExpenseProofField";

interface ExpenseReceiptFieldProps {
  receiptName: string | null;
  receiptUrl: string | null;
  uploadProgress: number | null;
  onFiles: (files: FileList) => void;
  onClear: () => void;
}

const RECEIPT_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv";

/** The receipt: the file the expense is evidenced by, uploaded as soon as it is picked. */
export function ExpenseReceiptField({ receiptName, receiptUrl, uploadProgress, onFiles, onClear }: ExpenseReceiptFieldProps) {
  let content: ReactNode;
  if (uploadProgress !== null) {
    content = (
      <div className="flex items-center gap-[10px] px-[16px] text-caption-l text-[#737373]">
        <Spinner size="xs" />
        Uploading… {uploadProgress}%
      </div>
    );
  } else if (receiptName) {
    content = <FileChip name={receiptName} icon={<FileText className="size-[18px]" aria-hidden />} href={receiptUrl} onRemove={onClear} removeLabel="Remove receipt" />;
  }

  return (
    <ExpenseUploadField
      label="Receipt"
      accept={RECEIPT_ACCEPT}
      prompt="Click or drag file to this area to upload"
      hint="Supports Excel, PDF, Word, CSV"
      onFiles={onFiles}
    >
      {content}
    </ExpenseUploadField>
  );
}

ExpenseReceiptField.displayName = "ExpenseReceiptField";

function FlagRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-[16px]">
      <div className="min-w-0 max-w-[270px]">
        <p className="text-caption-l font-semibold text-[#1E1E1E]">{title}</p>
        <p className="mt-[4px] text-caption-m text-[#8A8A8A]">{description}</p>
      </div>
      <ToggleSwitch size="sm" checked={checked} onChange={onChange} ariaLabel={title} />
    </div>
  );
}

FlagRow.displayName = "FlagRow";

/**
 * The two flags that stop an expense being read as final cost.
 *
 * A CREDIT is a refund or credit note against the category — which is what a
 * negative amount was being used for, wrongly, until the API started refusing
 * one. A RECOVERABLE outlay (a plant-hire deposit, a bond) comes back at the
 * end of the job, so it must not sit in used cost for ever.
 */
export function ExpenseFlagFields({
  credit,
  recoverable,
  onCreditChange,
  onRecoverableChange,
}: {
  credit: boolean;
  recoverable: boolean;
  onCreditChange: (next: boolean) => void;
  onRecoverableChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-[20px] pt-[2px]">
      <FlagRow
        title="Credit / refund"
        description="Money coming back against this category — a refund or a supplier credit note, not an outlay."
        checked={credit}
        onChange={onCreditChange}
      />
      <FlagRow
        title="Recoverable deposit"
        description="A deposit or bond you expect back — a plant-hire deposit is not final cost."
        checked={recoverable}
        onChange={onRecoverableChange}
      />
    </div>
  );
}

ExpenseFlagFields.displayName = "ExpenseFlagFields";
