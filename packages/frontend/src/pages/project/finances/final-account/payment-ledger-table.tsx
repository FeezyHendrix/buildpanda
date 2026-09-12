import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import { LEDGER_TYPE_TONE } from "@/lib/project-meta";
import type { Currency, LedgerType, PaymentLedgerEntry } from "@/lib/project-types";
import { cn } from "@/lib/utils";

const AMOUNT_CLASS: Record<LedgerType, string> = {
  Release: "text-success-600",
  Hold: "text-warning-600",
  Deposit: "text-ink",
};

function LedgerRow({ entry, currency }: { entry: PaymentLedgerEntry; currency: Currency }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-ink-subtle">{formatShortDate(entry.date)}</TableCell>
      <TableCell>
        <Badge tone={LEDGER_TYPE_TONE[entry.type]} size="sm">
          {entry.type}
        </Badge>
      </TableCell>
      <TableCell>{entry.description}</TableCell>
      <TableCell align="right" className={cn("font-medium tabular-nums", AMOUNT_CLASS[entry.type])}>
        {formatCurrency(entry.amount, currency)}
      </TableCell>
    </TableRow>
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
        <h3 className="text-sm font-semibold text-ink-muted">Payment ledger</h3>
        <p className="mt-1 text-xs text-ink-muted">
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
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell align="right">Amount</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {sorted.map((entry) => (
              <LedgerRow key={entry.id} entry={entry} currency={currency} />
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

PaymentLedgerTable.displayName = "PaymentLedgerTable";
