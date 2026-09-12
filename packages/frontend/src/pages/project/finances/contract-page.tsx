import { PageHeader } from "@/components/molecules/page-header";
import { CONTRACT_TABS } from "@/lib/finance-routes";
import { ContractStagesTab } from "./contract-stages";
import { ContractTermsTab } from "./contract-terms-tab";
import { FinalAccountTab } from "./final-account-tab";
import { FinancePageFrame, FinanceTabBar, useFinanceTab } from "./finance-tabs";

/** Contract: stage billing, the agreed terms, and the closing statement. */
export default function ProjectContractPage() {
  const { tab, setTab, visible } = useFinanceTab(CONTRACT_TABS);

  return (
    <FinancePageFrame>
      <PageHeader title="Contract" />
      <FinanceTabBar tabs={visible} value={tab} onChange={setTab} ariaLabel="Contract sections" />
      <div className="mt-6">
        {tab === "stages" ? <ContractStagesTab /> : null}
        {tab === "terms" ? <ContractTermsTab /> : null}
        {tab === "final-account" ? <FinalAccountTab /> : null}
      </div>
    </FinancePageFrame>
  );
}
