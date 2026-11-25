import type { Invoice } from "@/hooks/use-invoices";
import { formatCompactPrecise, formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ExpensePanel } from "../expenses/expense-panel";
import { invoiceKpis } from "./invoice-model";

function KpiCard({ label, value, helper, accent }: { label: string; value: string; helper: string; accent?: boolean }) {
  return (
    <ExpensePanel title={label}>
      <div className="px-[24px] pb-[22px] pt-[16px]">
        <p className={cn("truncate text-[24px] font-medium leading-[32px] tracking-[-0.02em] tabular-nums", accent ? "text-[#004DE7]" : "text-[#1E1E1E]")}>{value}</p>
        <p className="mt-[4px] truncate text-caption-l text-[#737373]">{helper}</p>
      </div>
    </ExpensePanel>
  );
}

KpiCard.displayName = "KpiCard";

function count(n: number): string {
  return `${n} ${n === 1 ? "invoice" : "invoices"}`;
}

/** Outstanding, pending, overdue and paid this month: figures read from the recorded invoices, never computed against a bank. */
export function InvoiceKpis({ invoices, currency }: { invoices: readonly Invoice[]; currency: string }) {
  const kpis = invoiceKpis(invoices);
  return (
    <section aria-label="Invoice summary" className="grid gap-[24px] sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Total Outstanding" value={formatCompactPrecise(kpis.outstanding.total, currency)} helper={`Across ${count(kpis.outstanding.count)}`} />
      <KpiCard label="Pending approval" value={String(kpis.pending.count)} helper={`Worth ${formatCurrency(kpis.pending.total, currency)}`} />
      <KpiCard label="Overdue" value={String(kpis.overdue.count)} helper={`Worth ${formatCurrency(kpis.overdue.total, currency)}`} />
      <KpiCard label="Paid this month" value={formatCompactPrecise(kpis.paidThisMonth.total, currency)} helper={`Across ${count(kpis.paidThisMonth.count)}`} accent />
    </section>
  );
}

InvoiceKpis.displayName = "InvoiceKpis";
