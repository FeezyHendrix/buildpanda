import { useMemo } from "react";
import { Link } from "react-router-dom";
import { KpiCard } from "@/components/molecules/kpi-card";
import { useProjectInvoices } from "@/hooks/use-invoices";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { financeTabPath } from "@/lib/finance-routes";
import { formatCurrency } from "@/lib/formatters";
import type { Currency, ProjectFinances } from "@/lib/project-types";
import { COMMITTED_PO_STATUSES } from "./purchase-orders/purchase-order-model";
import type { Settlement } from "./settlement-statement";

/**
 * The money position in five recorded figures. Each card names the record it
 * is read from and links to the tab that owns that record.
 */
interface MoneyStripProps {
  projectId: string;
  finances: ProjectFinances;
  settlement: Settlement;
  currency: Currency;
}

function LinkedKpi({
  to,
  label,
  value,
  helper,
}: {
  to: string;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Link to={to} className="block rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
      <KpiCard label={label} value={value} helper={helper} className="h-full transition-shadow hover:shadow-md" />
    </Link>
  );
}

export function MoneyStrip({ projectId, finances, settlement, currency }: MoneyStripProps) {
  const { data: purchaseOrders = [] } = usePurchaseOrders(projectId);
  const { data: invoices = [] } = useProjectInvoices(projectId);

  const committed = useMemo(
    () =>
      purchaseOrders
        .filter((po) => COMMITTED_PO_STATUSES.includes(po.status))
        .reduce((sum, po) => sum + po.total, 0),
    [purchaseOrders],
  );
  const invoiced = useMemo(
    () => invoices.filter((inv) => inv.status !== "Draft").reduce((sum, inv) => sum + inv.totalInvoiced, 0),
    [invoices],
  );

  const base = `/project/${projectId}/`;

  return (
    <section aria-label="Money position" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <LinkedKpi
        to={base + financeTabPath("finances/costs", "purchase-orders")}
        label="Committed"
        value={formatCurrency(committed, currency)}
        helper="Issued purchase orders"
      />
      <LinkedKpi
        to={base + financeTabPath("finances/billing", "invoices")}
        label="Invoiced"
        value={formatCurrency(invoiced, currency)}
        helper="Invoices sent"
      />
      <LinkedKpi
        to={base + financeTabPath("finances/contract", "final-account")}
        label="Certified"
        value={formatCurrency(finances.certifiedGrossToDate, currency)}
        helper="Certified gross to date"
      />
      <LinkedKpi
        to={base + financeTabPath("finances/billing", "stage-payments")}
        label="Paid"
        value={formatCurrency(finances.amountPaidToDate, currency)}
        helper="Stage payments recorded"
      />
      <LinkedKpi
        to={base + financeTabPath("finances/contract", "final-account")}
        label="Outstanding"
        value={formatCurrency(settlement.outstanding, currency)}
        helper="Adjusted contract less paid and retention"
      />
    </section>
  );
}

MoneyStrip.displayName = "MoneyStrip";
