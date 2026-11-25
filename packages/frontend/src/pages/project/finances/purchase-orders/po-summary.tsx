import { formatCurrency } from "@/lib/formatters";
import type { PurchaseOrder } from "@/hooks/use-purchase-orders";
import { ExpensePanel } from "../expenses/expense-panel";
import { committedTotal, receivedTotal } from "./purchase-order-model";

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <ExpensePanel title={label}>
      <div className="px-[24px] pb-[22px] pt-[16px]">
        <p className="truncate text-[24px] font-medium leading-[32px] tracking-[-0.02em] tabular-nums text-[#1E1E1E]">{value}</p>
        <p className="mt-[4px] text-caption-l text-[#737373] text-pretty">{helper}</p>
      </div>
    </ExpensePanel>
  );
}

SummaryCard.displayName = "SummaryCard";

/**
 * Committed and received are the server's figures (each PO carries the flag), so
 * this never re-derives which statuses count. Open is what has been issued and
 * not yet fully received.
 */
export function PoSummary({ purchaseOrders, currency }: { purchaseOrders: readonly PurchaseOrder[]; currency: string }) {
  const open = purchaseOrders
    .filter((po) => po.status === "Issued" || po.status === "PartiallyReceived")
    .reduce((sum, po) => sum + po.total, 0);

  return (
    <section aria-label="Purchase order summary" className="grid gap-[24px] md:grid-cols-3">
      <SummaryCard label="Committed spend" value={formatCurrency(committedTotal(purchaseOrders), currency)} helper="Issued onward — drafts and cancelled POs excluded" />
      <SummaryCard label="Open POs" value={formatCurrency(open, currency)} helper="Issued or part-received, not yet closed out" />
      <SummaryCard label="Received value" value={formatCurrency(receivedTotal(purchaseOrders), currency)} helper="Value of goods signed for so far" />
    </section>
  );
}

PoSummary.displayName = "PoSummary";
