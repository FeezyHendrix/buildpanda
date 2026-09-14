import { PageHeader } from "@/components/molecules/page-header";
import { BUDGET_INVOICES_TABS } from "@/lib/finance-routes";
import { BudgetSheetTab } from "./budget-sheet-tab";
import { FinancePageFrame, FinanceTabBar, useFinanceTab } from "./finance-tabs";
import { InvoicesTab } from "./invoices-tab";
import { PaymentsTab } from "./payments-tab";

/** Budget & invoices: the month-by-month billing sheet, the invoice register, and the payments recorded against it. */
export default function ProjectBudgetInvoicesPage() {
  const { tab, setTab, visible } = useFinanceTab(BUDGET_INVOICES_TABS);

  return (
    <FinancePageFrame>
      <PageHeader title="Budget & invoices" />
      <FinanceTabBar tabs={visible} value={tab} onChange={setTab} ariaLabel="Budget and invoice sections" />
      <div className="mt-6">
        {tab === "budget" ? <BudgetSheetTab /> : null}
        {tab === "invoices" ? <InvoicesTab /> : null}
        {tab === "payments" ? <PaymentsTab /> : null}
      </div>
    </FinancePageFrame>
  );
}
