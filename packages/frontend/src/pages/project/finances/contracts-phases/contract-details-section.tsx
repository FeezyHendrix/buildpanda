import { useRef, type ChangeEvent } from "react";
import { Button } from "@/components/atoms/button";
import { DrawerMetric, DrawerSectionTitle } from "../finance-drawer";
import type { Contract } from "@/hooks/use-contracts";
import { useUpdateContract } from "@/hooks/use-contracts";
import { useUploadFile } from "@/hooks/use-files";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import type { Currency } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { CONTRACT_KIND_LABEL, formatSignedDate, isPlaceholderContract } from "./contract-model";

/**
 * The particulars of one contract plus its signed document. Uploading goes
 * through the existing file upload hook, then the file id is recorded on the
 * contract; "Signed" is only possible once this document exists.
 */

interface ContractDetailsSectionProps {
  projectId: string;
  contract: Contract;
  currency: Currency;
  canManage: boolean;
}

export function ContractDetailsSection({ projectId, contract, currency, canManage }: ContractDetailsSectionProps) {
  const upload = useUploadFile();
  const update = useUpdateContract();
  const inputRef = useRef<HTMLInputElement>(null);
  const placeholder = isPlaceholderContract(contract);
  const busy = upload.isPending || update.isPending;

  function handleFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
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
        <DrawerSectionTitle>Details</DrawerSectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <DrawerMetric label="Kind" value={CONTRACT_KIND_LABEL[contract.kind]} />
          <DrawerMetric label="Trade" value={contract.trade ?? "—"} />
          <DrawerMetric label="Legal entity" value={contract.legalEntity ?? "—"} />
          <DrawerMetric label="Total" value={formatCurrency(contract.total, currency)} />
          <DrawerMetric label="Signed date" value={formatSignedDate(contract.signedAt)} />
          <DrawerMetric label="Phases" value={String(contract.phaseCount)} />
        </div>
      </section>

      <section>
        <DrawerSectionTitle>Document</DrawerSectionTitle>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line-hair px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{contract.documentName ?? "No document attached"}</p>
            <p className="text-xs text-ink-muted">
              {contract.documentId ? "The signed contract on file." : "Attach the signed contract to mark it Signed."}
            </p>
          </div>
          {canManage && !placeholder ? (
            <div className="flex items-center gap-2">
              <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />
              <Button variant="secondary" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
                {contract.documentId ? "Replace" : "Upload"}
              </Button>
              {contract.documentId ? (
                <Button variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
                  Remove
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {placeholder ? (
          <p className="mt-2 text-xs text-ink-muted">
            The main contract record is not on the API yet — add it from the Contracts tab to attach its document.
          </p>
        ) : null}
      </section>
    </>
  );
}

ContractDetailsSection.displayName = "ContractDetailsSection";
