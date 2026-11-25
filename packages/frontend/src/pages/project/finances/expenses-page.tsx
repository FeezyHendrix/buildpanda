import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { SectionTabs } from "@/components/molecules/section-tabs";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { useProjectContext } from "@/layouts/project-layout";
import { EXPENSES_TABS } from "@/lib/finance-routes";
import { ExpensesTab } from "./expenses-tab";
import { FinancePageFrame, useFinanceTab } from "./finance-tabs";
import { PurchaseOrdersTab } from "./purchase-orders-tab";

/**
 * Expenses: site spend logged with its receipt, and the vendor purchase orders
 * that commit spend first.
 *
 * Both are the contractor's own cost position, so the page needs
 * `finances:viewCosts`. A client-side role holds `finances:view` — the contract
 * they are party to — and gets the explanation rather than a page of 403s.
 */
export default function ProjectExpensesPage() {
  useSetPageTitle("Expenses", "Site spend logged with its receipt, and the purchase orders that commit spend first.");
  const { access } = useProjectContext();
  const { tab, setTab, visible } = useFinanceTab(EXPENSES_TABS);
  const canViewCosts = access?.capabilities?.canViewCosts ?? false;

  if (!canViewCosts) {
    return (
      <FinancePageFrame>
        <EmptyState
          icon={<FinancesIcon />}
          title="Costs are not shared on this project"
          description="Site spend and purchase orders are the contractor's internal cost position. Your access covers the contract itself — its certificates, retention and payments — on the Finance overview."
        />
      </FinancePageFrame>
    );
  }

  const tabs = <SectionTabs items={visible} value={tab} onChange={setTab} ariaLabel="Expense sections" />;

  return (
    <div className="w-full px-4 pb-8 pt-[24px] sm:px-10 lg:px-[40px]">
      {tab === "purchase-orders" ? <PurchaseOrdersTab tabs={tabs} /> : <ExpensesTab tabs={tabs} />}
    </div>
  );
}
