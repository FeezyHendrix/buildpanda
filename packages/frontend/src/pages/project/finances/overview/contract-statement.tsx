import type { FinanceSummary } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { percentPaid } from "../settlement-statement";

/**
 * The contract waterfall as the overview's Full Statement: how much of the
 * adjusted contract has been paid, then the four lines that get from the
 * original sum to what is still outstanding. Every figure is read from
 * `GET /finances/summary`; nothing here computes money. The only derived value
 * is the width of the bar, which is presentation, not a record.
 *
 * The full waterfall (adjusted sum, retention, every certificate) lives on the
 * contracts page; advance recovered appears here only when there is one.
 */

type Tone = "default" | "positive" | "negative" | "brand";

const TONE_CLASS: Record<Tone, string> = {
  default: "text-[#1E1E1E]",
  positive: "text-[#00A63E]",
  negative: "text-[#E7000B]",
  brand: "text-[#004DE7]",
};

function StatementLine({ operator, label, value, tone = "default" }: { operator?: string; label: string; value: string; tone?: Tone }) {
  return (
    <li className="flex min-h-[52px] items-center gap-[14px] py-[10px]">
      <span aria-hidden="true" className="w-[24px] shrink-0 text-center text-[16px] leading-none text-[#737373]">
        {operator}
      </span>
      <span className="min-w-0 flex-1 truncate text-caption-l text-[#1E1E1E]">{label}</span>
      <span className={cn("shrink-0 text-caption-l font-medium tabular-nums", TONE_CLASS[tone])}>{value}</span>
    </li>
  );
}

export function ContractStatement({ summary }: { summary: FinanceSummary }) {
  const money = (value: number) => formatCurrency(value, summary.currency);
  const paid = percentPaid(summary);
  const variations = summary.variationsTotal;

  return (
    <div className="pb-[8px] pt-[4px]">
      <div className="flex items-center justify-between text-caption-m text-[#1E1E1E]">
        <span>Paid vs adjusted contract</span>
        <span className="font-semibold tabular-nums">{paid}%</span>
      </div>
      <div className="mt-[8px] h-[6px] w-full bg-[#E5E5E5]" role="img" aria-label={`${paid}% of the adjusted contract paid`}>
        <div className="h-full bg-[#00A63E] transition-[width] duration-300" style={{ width: `${paid}%` }} />
      </div>

      <ul className="mt-[12px] divide-y divide-[#EEEEEE]">
        <StatementLine operator="=" label="Original contract sum" value={money(summary.contractSum)} />
        <StatementLine
          operator={variations >= 0 ? "+" : "−"}
          label="Variations"
          value={money(Math.abs(variations))}
          tone={variations >= 0 ? "positive" : "negative"}
        />
        <StatementLine operator="−" label="Certified to date" value={money(summary.certifiedGrossToDate)} />
        <StatementLine operator="=" label="Remaining to certify" value={money(summary.outstanding)} />
        <StatementLine operator="=" label="Outstanding balance" value={money(summary.unpaidCertified)} tone="brand" />
        {summary.advanceRecovered > 0 ? <StatementLine label="Advance recovered" value={money(summary.advanceRecovered)} /> : null}
      </ul>
    </div>
  );
}

ContractStatement.displayName = "ContractStatement";
