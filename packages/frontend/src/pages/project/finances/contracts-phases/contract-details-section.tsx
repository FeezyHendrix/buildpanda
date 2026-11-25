import { useRef, type ChangeEvent } from "react";
import { Button } from "@/components/atoms/button";
import { MediaDropzone } from "@/components/molecules/media-dropzone";
import type { Contract } from "@/hooks/use-contracts";
import { useUpdateContract } from "@/hooks/use-contracts";
import { useUploadFile } from "@/hooks/use-files";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import type { Currency } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { CONTRACT_KIND_LABEL, formatSignedDate, isPlaceholderContract } from "./contract-model";
import { SheetHeading, SheetMetric } from "./sheet-parts";

/**
 * The particulars of one contract plus its signed document. Uploading goes
 * through the existing file upload hook, then the file id is recorded on the
 * contract; "Signed" is only possible once this document exists.
 */

const DOCUMENT_ACCEPT = "application/pdf,.docx,image/*";
const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

interface ContractDetailsSectionProps {
  projectId: string;
  contract: Contract;
  currency: Currency;
  canManage: boolean;
}

export function ContractDetailsSection({ projectId, contract, currency, canManage }: ContractDetailsSectionProps) {
  const upload = useUploadFile();
  const update = useUpdateContract();
  const replaceRef = useRef<HTMLInputElement>(null);
  const placeholder = isPlaceholderContract(contract);
  const busy = upload.isPending || update.isPending;
  const canEditDocument = canManage && !placeholder;

  function attach(file: File | undefined): void {
    if (!file) return;
    if (file.size > DOCUMENT_MAX_BYTES) {
      toast("The document must be 10MB or smaller", "error");
      return;
    }
    upload.mutate(
      { file, projectId },
      {
        onSuccess: (uploaded) =>
          update.mutate(
            { projectId, contractId: contract.id, documentId: uploaded.id },
            {
              onSuccess: () => toast("Contract document attached", "success"),
              onError: (error) => toast(getApiErrorMessage(error, "Could not attach the document"), "error"),
            },
          ),
        onError: (error) => toast(getApiErrorMessage(error, "Upload failed"), "error"),
      },
    );
  }

  function handleReplace(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = "";
    attach(file);
  }

  function handleRemove(): void {
    update.mutate(
      { projectId, contractId: contract.id, documentId: null, ...(contract.status === "Signed" ? { status: "Pending" as const } : {}) },
      {
        onSuccess: () => toast("Contract document removed", "success"),
        onError: (error) => toast(getApiErrorMessage(error, "Could not remove the document"), "error"),
      },
    );
  }

  return (
    <>
      <section>
        <SheetHeading>Details</SheetHeading>
        <div className="mt-[18px] grid grid-cols-1 gap-x-[24px] gap-y-[16px] sm:grid-cols-2">
          <SheetMetric label="Kind" value={CONTRACT_KIND_LABEL[contract.kind]} />
          <SheetMetric label="Trade" value={contract.trade ?? "—"} />
          <SheetMetric label="Legal entity" value={contract.legalEntity ?? "—"} />
          <SheetMetric label="Total" value={formatCurrency(contract.total, currency)} />
          <SheetMetric label="Signed date" value={formatSignedDate(contract.signedAt)} />
          <SheetMetric label="Phases" value={String(contract.phaseCount)} />
        </div>
      </section>

      <section className="mt-[26px]">
        <SheetHeading>Document</SheetHeading>
        <p className="mt-[17px] truncate text-caption-l leading-[22px] text-[#1E1E1E]">{contract.documentName ?? "No document attached"}</p>
        <p className="mt-[2px] text-caption-m text-[#737373]">
          {contract.documentId ? "The signed contract on file." : "Attach the signed contract to mark it Signed."}
        </p>

        {contract.documentId ? (
          canEditDocument ? (
            <div className="mt-[8px] flex items-center gap-[8px]">
              <input ref={replaceRef} type="file" accept={DOCUMENT_ACCEPT} className="hidden" onChange={handleReplace} />
              <Button variant="secondary" size="sm" loading={busy} onClick={() => replaceRef.current?.click()}>
                Replace
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
                Remove
              </Button>
            </div>
          ) : null
        ) : (
          <div className="mt-[5px]">
            <MediaDropzone
              accept={DOCUMENT_ACCEPT}
              multiple={false}
              hint="PDF or DOCX (max. 10MB)"
              hintClassName="text-caption-l text-[#737373]"
              prompt={<span className="text-caption-l font-medium text-[#1E1E1E]">Click to upload or drag and drop</span>}
              onFiles={(files) => attach(files[0])}
              disabled={!canEditDocument || busy}
              height={123}
              className="rounded-none"
            />
          </div>
        )}
        {placeholder ? (
          <p className="mt-2 text-caption-m text-[#737373]">
            The main contract record is not on the API yet — add it from the Contracts tab to attach its document.
          </p>
        ) : null}
      </section>
    </>
  );
}

ContractDetailsSection.displayName = "ContractDetailsSection";
