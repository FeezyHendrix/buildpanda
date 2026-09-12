import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import { LEDGER_TYPE_TONE } from "@/lib/project-meta";
import type { Currency, LedgerType, PaymentLedgerEntry } from "@/lib/project-types";
import { cn } from "@/lib/utils";

const AMOUNT_CLASS: Record<LedgerType, string> = {
  Release: "text-emerald-600",
  Hold: "text-amber-600",
  Deposit: "text-gray-900",
};

function LedgerRow({ entry, currency }: { entry: PaymentLedgerEntry; currency: Currency }) {
  return (
    <tr className="border-b border-gray-50 last:border-b-0">
      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatShortDate(entry.date)}</td>
      <td className="px-4 py-3">
        <Badge tone={LEDGER_TYPE_TONE[entry.type]} size="sm">
          {entry.type}
        </Badge>
      </td>
      <td className="px-4 py-3 text-gray-900">{entry.description}</td>
      <td className={cn("px-4 py-3 text-right font-medium tabular-nums", AMOUNT_CLASS[entry.type])}>
        {formatCurrency(entry.amount, currency)}
      </td>
    </tr>
  );
}

/** Chronological trail of every release, deposit and hold logged against the project. */
export function PaymentLedgerTable({
  entries,
  currency,
}: {
  entries: PaymentLedgerEntry[];
  currency: Currency;
}) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries],
  );

  return (
    <Card padding="lg" className="mt-6">
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold text-black-300">Payment ledger</h3>
        <p className="mt-1 text-xs text-gray-500">
          Chronological trail of every release, deposit and hold logged against this project.
        </p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          variant="inline"
          title="No payment activity yet"
          description="Deposits, releases and retention holds will appear here as they are recorded."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry) => (
                <LedgerRow key={entry.id} entry={entry} currency={currency} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

PaymentLedgerTable.displayName = "PaymentLedgerTable";
