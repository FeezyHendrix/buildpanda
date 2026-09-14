import { Link } from "react-router-dom";
import { CONTRACTS_PHASES_PATH } from "@/lib/finance-routes";

/** Links an approved change order to the contract it generated, in the Contracts & phases drawer. */
export function ContractChip({ projectId, contractId }: { projectId: string; contractId: string }) {
  return (
    <Link
      to={`/project/${projectId}/${CONTRACTS_PHASES_PATH}?drawer=${encodeURIComponent(contractId)}`}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex h-5 items-center gap-1 rounded-md bg-primary-50 px-2 text-xs font-medium text-primary-500 hover:underline"
    >
      <span aria-hidden="true">⎘</span>
      Contract
    </Link>
  );
}

ContractChip.displayName = "ContractChip";
