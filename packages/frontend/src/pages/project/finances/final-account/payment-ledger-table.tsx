import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import { LEDGER_TYPE_TONE } from "@/lib/project-meta";
import type { Currency, LedgerType, PaymentLedgerEntry } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { SheetHeading } from "../contracts-phases/sheet-parts";

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
  paymentsPath,
}: {
  entries: PaymentLedgerEntry[];
  currency: Currency;
  paymentsPath: string;
}) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries],
  );

  return (
    <section aria-label="Funding activity">
      <SheetHeading>Funding activity</SheetHeading>
      <p className="mt-[6px] text-caption-m text-[#737373]">
        Funding deposits, milestone releases and holds. Invoice receipts are listed separately under Payments.
      </p>
      <Link
        to={paymentsPath}
        className={cn(
          "mt-[16px] inline-flex h-[36px] items-center border border-[#E5E5E5] bg-white px-[18px]",
          "text-caption-l font-medium text-[#1E1E1E] outline-none transition-colors hover:bg-[#F6F6F6]",
          "focus-visible:ring-2 focus-visible:ring-[#004DE7]/25",
        )}
      >
        View invoice payments
      </Link>

      {sorted.length > 0 ? (
        <div className="mt-[16px] border border-[#EEEEEE]">
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
        </div>
      ) : null}
    </section>
  );
}

PaymentLedgerTable.displayName = "PaymentLedgerTable";
