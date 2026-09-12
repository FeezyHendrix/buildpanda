import { PageHeader } from "@/components/molecules/page-header";
import { COSTS_TABS } from "@/lib/finance-routes";
import { BudgetTab } from "./budget-tab";
import { ExpensesTab } from "./expenses-tab";
import { FinancePageFrame, FinanceTabBar, useFinanceTab } from "./finance-tabs";
import { PurchaseOrdersTab } from "./purchase-orders-tab";

/** Costs: the budget by category, site expenses, and vendor purchase orders. */
export default function ProjectCostsPage() {
  const { tab, setTab, visible } = useFinanceTab(COSTS_TABS);

  return (
    <FinancePageFrame>
      <PageHeader title="Costs" />
      <FinanceTabBar tabs={visible} value={tab} onChange={setTab} ariaLabel="Cost sections" />
      <div className="mt-6">
        {tab === "budget" ? <BudgetTab /> : null}
        {tab === "expenses" ? <ExpensesTab /> : null}
        {tab === "purchase-orders" ? <PurchaseOrdersTab /> : null}
      </div>
    </FinancePageFrame>
  );
}
