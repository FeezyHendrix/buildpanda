import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import type { Contract } from "@/hooks/use-contracts";
import type { Currency, Stage } from "@/lib/project-types";
import { ContractDetailsSection } from "./contract-details-section";
import { CONTRACT_STATUS_META, contractSubtitle, isPlaceholderContract } from "./contract-model";
import { ContractPhasesSection } from "./contract-phases-section";
import { DetailSheet } from "./detail-sheet";
import { ContractTermsSection } from "./contract-terms-section";
import { FinalAccountSection } from "./final-account-section";

/**
 * One contract, read in place. Details and Phases for every contract; Terms
 * and Final account only for the main contract, since retention, advance and
 * the closing statement are agreed once for the build.
 */

export type ContractView = "details" | "terms" | "phases" | "final-account";

const ALL_VIEWS = [
  { id: "details", label: "Details" },
  { id: "terms", label: "Terms" },
  { id: "phases", label: "Phases" },
  { id: "final-account", label: "Final Account" },
] as const satisfies readonly { id: ContractView; label: string }[];

const CHANGE_ORDER_VIEWS = ALL_VIEWS.filter((view) => view.id === "details" || view.id === "phases");

export function isContractView(value: string | null): value is ContractView {
  return ALL_VIEWS.some((view) => view.id === value);
}

interface ContractDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  contract: Contract;
  phases: Stage[];
  currency: Currency;
  canManage: boolean;
  view: ContractView;
  onViewChange: (view: ContractView) => void;
  onEdit: (contract: Contract) => void;
  onOpenPhase: (stage: Stage) => void;
}

export function ContractDrawer({
  open,
  onOpenChange,
  projectId,
  contract,
  phases,
  currency,
  canManage,
  view,
  onViewChange,
  onEdit,
  onOpenPhase,
}: ContractDrawerProps) {
  const views = contract.kind === "main" ? ALL_VIEWS : CHANGE_ORDER_VIEWS;
  const status = CONTRACT_STATUS_META[contract.status];
  const activeView = views.some((candidate) => candidate.id === view) ? view : "details";

  return (
    <DetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={contract.title}
      status={
        <Badge tone={status.tone} size="sm" className="text-caption-m font-medium">
          {status.label}
        </Badge>
      }
      subtitle={contractSubtitle(contract)}
      tabs={views}
      activeTab={activeView}
      onTabChange={onViewChange}
      cancelWidthClassName="w-[238px]"
      action={
        canManage && !isPlaceholderContract(contract) ? (
          <Button type="button" size="lg" className="h-[46px] w-[245px]" onClick={() => onEdit(contract)}>
            Edit Contract
          </Button>
        ) : undefined
      }
    >
      {activeView === "details" ? (
        <ContractDetailsSection projectId={projectId} contract={contract} currency={currency} canManage={canManage} />
      ) : null}
      {activeView === "terms" ? <ContractTermsSection /> : null}
      {activeView === "phases" ? (
        <ContractPhasesSection phases={phases} contractTotal={contract.total} currency={currency} onOpenPhase={onOpenPhase} />
      ) : null}
      {activeView === "final-account" ? <FinalAccountSection /> : null}
    </DetailSheet>
  );
}

ContractDrawer.displayName = "ContractDrawer";
