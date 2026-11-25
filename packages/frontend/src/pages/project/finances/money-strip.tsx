import { Link } from "react-router-dom";
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

/** One figure under a 37px title bar; the whole card links to the tab that owns the record. */
function LinkedKpi({ to, label, value, helper }: { to: string; label: string; value: string; helper: string }) {
  return (
    <Link
      to={to}
      className="flex min-w-0 flex-col border border-[#EEEEEE] bg-white outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-gray-900/10"
    >
      <span className="flex h-[37px] items-center border-b border-[#EEEEEE] px-[24px] text-caption-l font-medium text-[#1E1E1E]">
        {label}
      </span>
      <span className="flex flex-1 flex-col px-[24px] pb-[24px] pt-[18px]">
        <span className="overflow-hidden text-ellipsis text-[22px] font-medium leading-[28px] tabular-nums text-[#1E1E1E] [overflow-wrap:normal]">
          {value}
        </span>
        <span className="mt-[4px] text-caption-l text-[#737373]">{helper}</span>
      </span>
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
    <section aria-label="Money position" className="grid gap-[24px] sm:grid-cols-2 xl:grid-cols-4">
      <LinkedKpi to={invoicesHref} label="Certified to Date" value={money(summary.certifiedGrossToDate)} helper="Approved certificates, gross" />
      <LinkedKpi to={paymentsHref} label="Paid to Date" value={money(summary.amountPaidToDate)} helper="Receipts recorded on those certificates" />
      <LinkedKpi to={paymentsHref} label="Unpaid Certified" value={money(summary.unpaidCertified)} helper="Certified but not yet received" />
      <LinkedKpi to={base + CONTRACTS_PHASES_PATH} label="Still to Certify" value={money(summary.outstanding)} helper="Adjusted contract less certified" />
    </section>
  );
}

MoneyStrip.displayName = "MoneyStrip";
