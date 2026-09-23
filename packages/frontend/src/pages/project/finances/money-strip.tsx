import { Link } from "react-router-dom";
import { KpiCard } from "@/components/molecules/kpi-card";
import type { FinanceSummary } from "@/hooks/use-finances";
import { BUDGET_INVOICES_PATH, CONTRACTS_PHASES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCurrency } from "@/lib/formatters";

/**
 * The money position in the four figures `GET /finances/summary` reports. Each
 * card names the record it is read from and links to the tab that owns it;
 * none of these numbers is computed here.
 */
interface MoneyStripProps {
  projectId: string;
  summary: FinanceSummary;
}

function LinkedKpi({ to, label, value, helper }: { to: string; label: string; value: string; helper: string }) {
  return (
    <Link to={to} className="block rounded-[16px] focus-visible:shadow-focus focus-visible:outline-none">
      <KpiCard label={label} value={value} helper={helper} className="h-full transition-shadow hover:shadow-md" />
    </Link>
  );
}

LinkedKpi.displayName = "LinkedKpi";

export function MoneyStrip({ projectId, summary }: MoneyStripProps) {
  const money = (value: number) => formatCurrency(value, summary.currency);
  const base = `/project/${projectId}/`;
  const invoicesHref = base + financeTabPath(BUDGET_INVOICES_PATH, "invoices");
  const paymentsHref = base + financeTabPath(BUDGET_INVOICES_PATH, "payments");

  return (
    <section aria-label="Money position" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <LinkedKpi to={invoicesHref} label="Certified to date" value={money(summary.certifiedGrossToDate)} helper="Approved certificates, gross" />
      <LinkedKpi to={paymentsHref} label="Paid to date" value={money(summary.amountPaidToDate)} helper="Receipts recorded on those certificates" />
      <LinkedKpi to={paymentsHref} label="Unpaid certified" value={money(summary.unpaidCertified)} helper="Certified but not yet received" />
      <LinkedKpi to={base + CONTRACTS_PHASES_PATH} label="Still to certify" value={money(summary.outstanding)} helper="Adjusted contract less certified" />
    </section>
  );
}

MoneyStrip.displayName = "MoneyStrip";
