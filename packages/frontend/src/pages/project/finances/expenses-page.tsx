import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import { EXPENSES_TABS } from "@/lib/finance-routes";
import { ExpensesTab } from "./expenses-tab";
import { FinancePageFrame, FinanceTabBar, useFinanceTab } from "./finance-tabs";
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
  const { access } = useProjectContext();
  const { tab, setTab, visible } = useFinanceTab(EXPENSES_TABS);
  const canViewCosts = access?.capabilities?.canViewCosts ?? false;

  if (!canViewCosts) {
    return (
      <FinancePageFrame>
        <PageHeader title="Expenses" />
        <EmptyState
          icon={<FinancesIcon />}
          title="Costs are not shared on this project"
          description="Site spend and purchase orders are the contractor's internal cost position. Your access covers the contract itself — its certificates, retention and payments — on the Finance overview."
        />
      </FinancePageFrame>
    );
  }

  return (
    <FinancePageFrame>
      <PageHeader title="Expenses" />
      <FinanceTabBar tabs={visible} value={tab} onChange={setTab} ariaLabel="Expense sections" />
      <div className="mt-6">
        {tab === "expenses" ? <ExpensesTab /> : null}
        {tab === "purchase-orders" ? <PurchaseOrdersTab /> : null}
      </div>
    </FinancePageFrame>
  );
}
