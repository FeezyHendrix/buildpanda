import { formatCurrency } from "@/lib/formatters";
import type { ProjectFinances } from "@/lib/project-types";
import { cn } from "@/lib/utils";

/**
 * The contract waterfall: contract sum → variations → adjusted contract →
 * certified → paid → retention → outstanding. Every figure is a recorded
 * amount; the statement explains how the outstanding balance is computed,
 * it never settles it.
 */
export interface Settlement {
  retentionHeld: number;
  remainingToCertify: number;
  outstanding: number;
  percentPaid: number;
  isSettled: boolean;
}

export function computeSettlement(finances: ProjectFinances, retentionHeld: number): Settlement {
  const remainingToCertify = Math.max(0, finances.adjustedContract - finances.certifiedGrossToDate);
  const outstanding = Math.max(
    0,
    finances.adjustedContract - finances.amountPaidToDate - retentionHeld,
  );
  const percentPaid =
    finances.adjustedContract > 0
      ? Math.min(100, Math.round((finances.amountPaidToDate / finances.adjustedContract) * 100))
      : 0;
  return {
    retentionHeld,
    remainingToCertify,
    outstanding,
    percentPaid,
    isSettled: finances.adjustedContract > 0 && outstanding === 0 && remainingToCertify === 0,
  };
}

type LineTone = "muted" | "positive" | "negative" | "brand";

const TONE_CLASS: Record<LineTone, string> = {
  muted: "text-ink",
  positive: "text-success-600",
  negative: "text-negative-600",
  brand: "text-primary-500",
};

export function SettlementLine({
  label,
  value,
  tone = "muted",
  operator,
  emphasis,
}: {
  label: string;
  value: string;
  tone?: LineTone;
  operator?: "+" | "−" | "=";
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3",
        emphasis
          ? "border-t border-gray-900/10 mt-1 pt-4"
          : "border-t border-line-hair first:border-t-0 first:pt-0",
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        {operator ? (
          <span className="w-4 text-center font-semibold text-ink-muted">{operator}</span>
        ) : (
          <span className="w-4" aria-hidden="true" />
        )}
        <span className={cn(emphasis ? "text-sm font-semibold text-ink" : "text-gray-600")}>
          {label}
        </span>
      </div>
      <span
        className={cn(
          "tabular-nums",
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

export function SettlementStatement({
  finances,
  settlement,
}: {
  finances: ProjectFinances;
  settlement: Settlement;
}) {
  const currency = finances.currency;
  return (
    <div>
      <SettlementLine
        label="Original contract sum"
        value={formatCurrency(finances.contractSum, currency)}
      />
      <SettlementLine
        label="Variations"
        operator={finances.variationsTotal >= 0 ? "+" : "−"}
        tone={finances.variationsTotal >= 0 ? "positive" : "negative"}
        value={formatCurrency(Math.abs(finances.variationsTotal), currency)}
      />
      <SettlementLine
        label="Adjusted contract sum"
        operator="="
        tone="brand"
        value={formatCurrency(finances.adjustedContract, currency)}
        emphasis
      />
      <SettlementLine
        label="Certified to date"
        operator="−"
        value={formatCurrency(finances.certifiedGrossToDate, currency)}
      />
      <SettlementLine
        label="Remaining to certify"
        operator="="
        value={formatCurrency(settlement.remainingToCertify, currency)}
      />
      <SettlementLine
        label="Amount paid to date"
        operator="−"
        value={formatCurrency(finances.amountPaidToDate, currency)}
      />
      <SettlementLine
        label="Retention held"
        operator="−"
        value={formatCurrency(settlement.retentionHeld, currency)}
      />
      <SettlementLine
        label="Outstanding balance"
        operator="="
        tone="brand"
        value={formatCurrency(settlement.outstanding, currency)}
        emphasis
      />

      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span>Paid vs adjusted contract</span>
          <span className="font-semibold text-ink tabular-nums">{settlement.percentPaid}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full rounded-full bg-surface-track">
          <div
            className="h-full rounded-full bg-primary-500 transition-[width] duration-300"
            style={{ width: `${settlement.percentPaid}%` }}
          />
        </div>
      </div>
    </div>
  );
}

SettlementStatement.displayName = "SettlementStatement";
