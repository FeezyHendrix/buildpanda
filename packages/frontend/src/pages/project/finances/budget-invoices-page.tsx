import { SectionTabs } from "@/components/molecules/section-tabs";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { BUDGET_INVOICES_TABS } from "@/lib/finance-routes";
import { BudgetSheetTab } from "./budget-sheet-tab";
import { useFinanceTab } from "./finance-tabs";
import { InvoicesTab } from "./invoices-tab";
import { PaymentsTab } from "./payments-tab";

/** Budget & invoices: the month-by-month billing sheet, the invoice register, and the payments recorded against it. */
export default function ProjectBudgetInvoicesPage() {
  useSetPageTitle("Budget & invoices", "The billing sheet, the invoices raised against it, and the payments recorded.");
  const { tab, setTab, visible } = useFinanceTab(BUDGET_INVOICES_TABS);
  const tabs = <SectionTabs items={visible} value={tab} onChange={setTab} ariaLabel="Budget and invoice sections" />;

  return (
    <div className="w-full px-4 pb-8 pt-[24px] sm:px-10 lg:px-[40px]">
      {tab === "invoices" ? (
        <InvoicesTab tabs={tabs} />
      ) : (
        <>
          <div className="flex">{tabs}</div>
          <div className="mt-[24px]">
            {tab === "budget" ? <BudgetSheetTab /> : null}
            {tab === "payments" ? <PaymentsTab /> : null}
          </div>
        </>
      )}
    </div>
  );
}
