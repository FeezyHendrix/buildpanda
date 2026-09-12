import { PageHeader } from "@/components/molecules/page-header";
import { BILLING_TABS } from "@/lib/finance-routes";
import { PaymentRequestsSection } from "../payments/payment-requests-section";
import { StagePaymentsSection } from "../payments/stage-payments-section";
import { FinancePageFrame, FinanceTabBar, useFinanceTab } from "./finance-tabs";
import { InvoicesTab } from "./invoices-tab";

/** Billing: invoices, contractor payment requests and stage payments — all recorded, never charged. */
export default function ProjectBillingPage() {
  const { tab, setTab, visible } = useFinanceTab(BILLING_TABS);

  return (
    <FinancePageFrame>
      <PageHeader title="Billing" />
      <FinanceTabBar tabs={visible} value={tab} onChange={setTab} ariaLabel="Billing sections" />
      <div className="mt-6">
        {tab === "invoices" ? <InvoicesTab /> : null}
        {tab === "payment-requests" ? <PaymentRequestsSection /> : null}
        {tab === "stage-payments" ? <StagePaymentsSection /> : null}
      </div>
    </FinancePageFrame>
  );
}
