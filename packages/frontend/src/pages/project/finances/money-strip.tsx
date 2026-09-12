import { useMemo } from "react";
import { Link } from "react-router-dom";
import { KpiCard } from "@/components/molecules/kpi-card";
import { useProjectInvoices } from "@/hooks/use-invoices";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import {
  BUDGET_INVOICES_PATH,
  EXPENSES_PATH,
  FINAL_ACCOUNT_PATH,
  financeTabPath,
} from "@/lib/finance-routes";
import { formatCurrency } from "@/lib/formatters";
import { Money } from "@/lib/money";
import type { Currency, ProjectFinances } from "@/lib/project-types";
import { COMMITTED_PO_STATUSES } from "./purchase-orders/purchase-order-model";
import type { Settlement } from "./settlement-statement";

/**
 * The money position in four recorded figures. Each card names the record it
 * is read from and links to the tab that owns that record.
 */
interface MoneyStripProps {
  projectId: string;
  finances: ProjectFinances;
  settlement: Settlement;
  currency: Currency;
}

function LinkedKpi({ to, label, value, helper }: { to: string; label: string; value: string; helper: string }) {
  return (
    <Link to={to} className="block rounded-[16px] focus-visible:outline-none focus-visible:shadow-focus">
      <KpiCard label={label} value={value} helper={helper} className="h-full transition-shadow hover:shadow-md" />
    </Link>
  );
}

export function MoneyStrip({ projectId, finances, settlement, currency }: MoneyStripProps) {
  const { data: purchaseOrders = [] } = usePurchaseOrders(projectId);
  const { data: invoices = [] } = useProjectInvoices(projectId);

  const committed = useMemo(
    () =>
      Money.sum(
        purchaseOrders.filter((po) => COMMITTED_PO_STATUSES.includes(po.status)).map((po) => po.total),
      ).round(2).toNumber(),
    [purchaseOrders],
  );
  const invoiced = useMemo(
    () => Money.sum(invoices.filter((inv) => inv.status !== "Draft").map((inv) => inv.totalInvoiced)).round(2).toNumber(),
    [invoices],
  );

  const base = `/project/${projectId}/`;

  return (
    <section aria-label="Money position" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <LinkedKpi
        to={base + financeTabPath(EXPENSES_PATH, "purchase-orders")}
        label="Committed"
        value={formatCurrency(committed, currency)}
        helper="Issued purchase orders"
      />
      <LinkedKpi
        to={base + financeTabPath(BUDGET_INVOICES_PATH, "invoices")}
        label="Invoiced"
        value={formatCurrency(invoiced, currency)}
        helper="Invoices sent"
      />
      <LinkedKpi
        to={base + financeTabPath(BUDGET_INVOICES_PATH, "payments")}
        label="Paid"
        value={formatCurrency(finances.amountPaidToDate, currency)}
        helper="Payments recorded"
      />
      <LinkedKpi
        to={base + FINAL_ACCOUNT_PATH}
        label="Outstanding"
        value={formatCurrency(settlement.outstanding, currency)}
        helper="Adjusted contract less paid and retention"
      />
    </section>
  );
}

MoneyStrip.displayName = "MoneyStrip";
