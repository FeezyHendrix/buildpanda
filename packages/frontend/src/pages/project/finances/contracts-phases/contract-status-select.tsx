import { useState, type ChangeEvent } from "react";
import { Badge } from "@/components/atoms/badge";
import { CONTRACT_STATUSES, type Contract, type ContractStatus } from "@/api/contracts";
import { useUpdateContract } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CONTRACT_STATUS_META, isPlaceholderContract, SIGNED_NEEDS_DOCUMENT } from "./contract-model";

/**
 * Inline status on a contract row. Draft → Pending → Signed are all offered,
 * but Signed stays disabled until the executed document is attached — a
 * contract is only signed once the paper exists.
 */

const TONE_CLASS: Record<ContractStatus, string> = {
  Draft: "bg-neutral-50 text-neutral-500",
  Pending: "bg-warning-50 text-warning-500",
  Signed: "bg-success-50 text-success-500",
};

interface ContractStatusSelectProps {
  projectId: string;
  contract: Contract;
  disabled?: boolean;
}

export function ContractStatusSelect({ projectId, contract, disabled = false }: ContractStatusSelectProps) {
  const update = useUpdateContract();
  const [pending, setPending] = useState<ContractStatus | null>(null);
  const shown = pending ?? contract.status;
  const meta = CONTRACT_STATUS_META[shown];
  const hasDocument = Boolean(contract.documentId);

  if (disabled || isPlaceholderContract(contract)) {
    return (
      <Badge tone={meta.tone} size="md" className="gap-1.5">
        <span aria-hidden="true">{meta.marker}</span>
        {meta.label}
      </Badge>
    );
  }

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const status = event.target.value as ContractStatus;
    if (status === contract.status) return;
    if (status === "Signed" && !hasDocument) {
      toast(SIGNED_NEEDS_DOCUMENT, "error");
      return;
    }
    setPending(status);
    update.mutate(
      { projectId, contractId: contract.id, status },
      {
        onSuccess: () => toast(`${contract.title} marked ${status.toLowerCase()}`, "success"),
        onError: (error) => toast(getApiErrorMessage(error, "Could not update the contract status"), "error"),
        onSettled: () => setPending(null),
      },
    );
  }

  return (
    <select
      value={shown}
      onChange={handleChange}
      onClick={(event) => event.stopPropagation()}
      disabled={update.isPending}
      aria-label={`Status of ${contract.title}`}
      title={hasDocument ? undefined : SIGNED_NEEDS_DOCUMENT}
      className={cn(
        "h-7 w-auto max-w-[120px] cursor-pointer appearance-none rounded-full border-0 pl-2.5 pr-6 text-xs font-medium outline-none",
        "bg-[length:10px] bg-[right_8px_center] bg-no-repeat focus-visible:shadow-focus disabled:opacity-60",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%221.5%22 stroke-linecap=%22round%22><path d=%22m3 4.5 3 3 3-3%22/></svg>')]",
        TONE_CLASS[shown],
      )}
    >
      {CONTRACT_STATUSES.map((status) => (
        <option
          key={status}
          value={status}
          disabled={status === "Signed" && !hasDocument}
          title={status === "Signed" && !hasDocument ? SIGNED_NEEDS_DOCUMENT : undefined}
        >
          {CONTRACT_STATUS_META[status].marker} {CONTRACT_STATUS_META[status].label}
        </option>
      ))}
    </select>
  );
}

ContractStatusSelect.displayName = "ContractStatusSelect";
