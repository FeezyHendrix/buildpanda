import type { FinanceSummary } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/**
 * The contract waterfall, read straight off `GET /finances/summary` — the one
 * money model. Certification comes only from approved receivable certificates
 * and payment only from the receipts recorded on them; funding deposits and
 * milestone releases are a separate ledger and never appear here.
 *
 * Nothing in this file computes a money figure. The only derived value is the
 * width of the progress bar, which is presentation, not a record.
 */

type LineTone = "muted" | "positive" | "negative" | "brand";

const TONE_CLASS: Record<LineTone, string> = {
  muted: "text-ink",
  positive: "text-success-600",
  negative: "text-negative-600",
  brand: "text-primary-500",
};

/** Share of the adjusted contract already received, for the bar only. */
export function percentPaid(summary: FinanceSummary): number {
  if (summary.adjustedContract <= 0) return 0;
  return Math.min(100, Math.round((summary.amountPaidToDate / summary.adjustedContract) * 100));
}

/** A contract is settled when there is nothing left to certify, receive or hold. */
export function isSettled(summary: FinanceSummary): boolean {
  return (
    summary.adjustedContract > 0 &&
    summary.outstanding === 0 &&
    summary.unpaidCertified === 0 &&
    summary.retentionHeld === 0
  );
}

export function SettlementLine({
  label,
  value,
  tone = "muted",
  operator,
  emphasis,
  helper,
}: {
  label: string;
  value: string;
  tone?: LineTone;
  operator?: "+" | "−" | "=";
  emphasis?: boolean;
  helper?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 py-3",
        emphasis
          ? "mt-1 border-t border-gray-900/10 pt-4"
          : "border-t border-line-hair first:border-t-0 first:pt-0",
      )}
    >
      <div className="flex items-start gap-3 text-sm">
        {operator ? (
          <span className="w-4 text-center font-semibold text-ink-muted">{operator}</span>
        ) : (
          <span className="w-4" aria-hidden="true" />
        )}
        <div>
          <span className={cn(emphasis ? "text-sm font-semibold text-ink" : "text-gray-600")}>
            {label}
          </span>
          {helper ? <p className="mt-0.5 text-xs text-ink-muted">{helper}</p> : null}
        </div>
      </div>
      <span
        className={cn(
          "whitespace-nowrap tabular-nums",
          emphasis ? "text-lg font-medium" : "text-sm font-medium",
          TONE_CLASS[tone],
        )}
      >
        {value}
      </span>
    </div>
  );
}

SettlementLine.displayName = "SettlementLine";

export function SettlementStatement({ summary }: { summary: FinanceSummary }) {
  const currency = summary.currency;
  const money = (value: number) => formatCurrency(value, currency);
  const paid = percentPaid(summary);

  return (
    <div>
      <SettlementLine label="Original contract sum" value={money(summary.contractSum)} />
      <SettlementLine
        label="Variations"
        operator={summary.variationsTotal >= 0 ? "+" : "−"}
        tone={summary.variationsTotal >= 0 ? "positive" : "negative"}
        value={money(Math.abs(summary.variationsTotal))}
      />
      <SettlementLine
        label="Adjusted contract sum"
        operator="="
        tone="brand"
        value={money(summary.adjustedContract)}
        emphasis
      />
      <SettlementLine
        label="Certified gross to date"
        operator="−"
        helper="Approved and paid certificates issued to the employer"
        value={money(summary.certifiedGrossToDate)}
      />
      <SettlementLine
        label="Still to certify"
        operator="="
        value={money(summary.outstanding)}
      />
      <SettlementLine
        label="Amount paid to date"
        operator="−"
        helper="Receipts recorded against those certificates"
        value={money(summary.amountPaidToDate)}
      />
      <SettlementLine
        label="Unpaid certified"
        operator="="
        tone={summary.unpaidCertified > 0 ? "negative" : "muted"}
        value={money(summary.unpaidCertified)}
        emphasis
      />
      <SettlementLine
        label="Retention held"
        helper="Deducted on the certificates above; released under the contract terms"
        value={money(summary.retentionHeld)}
      />
      {summary.advanceRecovered > 0 ? (
        <SettlementLine label="Advance recovered" value={money(summary.advanceRecovered)} />
      ) : null}

      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span>Paid vs adjusted contract</span>
          <span className="font-semibold tabular-nums text-ink">{paid}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full rounded-full bg-surface-track">
          <div
            className="h-full rounded-full bg-primary-500 transition-[width] duration-300"
            style={{ width: `${paid}%` }}
          />
        </div>
      </div>
    </div>
  );
}

SettlementStatement.displayName = "SettlementStatement";
