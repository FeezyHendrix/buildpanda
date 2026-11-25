import { Equal, Minus, Plus } from "lucide-react";
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

type LineTone = "default" | "positive" | "negative" | "brand";
type Operator = "+" | "−" | "=";

const TONE_CLASS: Record<LineTone, string> = {
  default: "text-[#1E1E1E]",
  positive: "text-[#00A63E]",
  negative: "text-[#E7000B]",
  brand: "text-[#004DE7]",
};

const OPERATOR_ICON: Record<Operator, typeof Plus> = { "+": Plus, "−": Minus, "=": Equal };

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
  tone = "default",
  operator,
  emphasis,
  helper,
}: {
  label: string;
  value: string;
  tone?: LineTone;
  operator?: Operator;
  emphasis?: boolean;
  helper?: string;
}) {
  const OperatorIcon = operator ? OPERATOR_ICON[operator] : null;
  return (
    <li className="flex min-h-[53px] items-center border-b border-[#EEEEEE] py-[8px] last:border-b-0">
      <span aria-hidden="true" className="flex w-[39px] shrink-0 items-center pl-[3px] text-[#A3A3A3]">
        {OperatorIcon ? <OperatorIcon className="size-[16px]" strokeWidth={1.5} /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-caption-l text-[#1E1E1E]", emphasis && "font-semibold")}>{label}</p>
        {helper ? <p className="text-caption-m text-[#737373]">{helper}</p> : null}
      </div>
      <span className={cn("shrink-0 whitespace-nowrap pl-4 text-caption-l font-medium tabular-nums", TONE_CLASS[tone])}>
        {value}
      </span>
    </li>
  );
}

SettlementLine.displayName = "SettlementLine";

export function SettlementStatement({ summary }: { summary: FinanceSummary }) {
  const currency = summary.currency;
  const money = (value: number) => formatCurrency(value, currency);
  const paid = percentPaid(summary);

  return (
    <div>
      <div className="flex items-center justify-between text-caption-m text-[#1E1E1E]">
        <span>Paid vs adjusted contract</span>
        <span className="text-caption-l font-medium tabular-nums">{paid}%</span>
      </div>
      <div className="mt-[8px] h-[7px] w-full bg-[#E5E5E5]" role="img" aria-label={`${paid}% of the adjusted contract paid`}>
        <div className="h-full bg-[#00A63E] transition-[width] duration-300" style={{ width: `${paid}%` }} />
      </div>

      <ul className="mt-[16px]">
        <SettlementLine label="Original contract sum" value={money(summary.contractSum)} />
        <SettlementLine
          label="Variations"
          operator={summary.variationsTotal >= 0 ? "+" : "−"}
          tone={summary.variationsTotal >= 0 ? "positive" : "negative"}
          value={money(Math.abs(summary.variationsTotal))}
        />
        <SettlementLine label="Adjusted contract sum" operator="=" tone="brand" value={money(summary.adjustedContract)} emphasis />
        <SettlementLine
          label="Certified gross to date"
          operator="−"
          helper="Approved and paid certificates issued to the employer"
          value={money(summary.certifiedGrossToDate)}
        />
        <SettlementLine label="Still to certify" operator="=" tone="brand" value={money(summary.outstanding)} />
        <SettlementLine
          label="Amount paid to date"
          operator="−"
          helper="Receipts recorded against those certificates"
          value={money(summary.amountPaidToDate)}
        />
        <SettlementLine
          label="Unpaid certified"
          operator="="
          tone={summary.unpaidCertified > 0 ? "negative" : "brand"}
          value={money(summary.unpaidCertified)}
          emphasis
        />
        <SettlementLine
          label="Retention held"
          operator="−"
          helper="Deducted on the certificates above; released under the contract terms"
          value={money(summary.retentionHeld)}
        />
        {summary.advanceRecovered > 0 ? <SettlementLine label="Advance recovered" value={money(summary.advanceRecovered)} /> : null}
      </ul>
    </div>
  );
}

SettlementStatement.displayName = "SettlementStatement";
