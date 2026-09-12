import { PageHeader } from "@/components/molecules/page-header";
import { EXPENSES_TABS } from "@/lib/finance-routes";
import { ExpensesTab } from "./expenses-tab";
import { FinancePageFrame, FinanceTabBar, useFinanceTab } from "./finance-tabs";
import { PurchaseOrdersTab } from "./purchase-orders-tab";

/** Expenses: site spend logged with its receipt, and the vendor purchase orders that commit spend first. */
export default function ProjectExpensesPage() {
  const { tab, setTab, visible } = useFinanceTab(EXPENSES_TABS);

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
