import { Badge } from "@/components/atoms/badge";
import { formatWholeCurrency } from "@/lib/formatters";
import type { StageValueSummary } from "@/hooks/use-stages";

interface StageValueSummaryBarProps {
  summary: StageValueSummary | undefined;
  currency: string;
}

/**
 * "₦850,000,000 of ₦850,000,000 allocated · nothing unallocated". Pricing a
 * twelve-stage programme used to need a calculator, because nothing anywhere
 * added the stage values up against the contract sum (finding #21).
 */
function StageValueSummaryBar({ summary, currency }: StageValueSummaryBarProps) {
  if (!summary || summary.contractSum <= 0) return null;

  const { valueTotal, contractSum, unallocated, allocatedPercent } = summary;
  const over = unallocated < 0;

  return (
    <section
      aria-label="Stage value allocation"
      className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line-hair bg-white px-4 py-3"
    >
      <p className="text-[13px] text-ink">
        <span className="font-semibold tabular-nums">{formatWholeCurrency(valueTotal, currency)}</span>{" "}
        of{" "}
        <span className="font-semibold tabular-nums">{formatWholeCurrency(contractSum, currency)}</span>{" "}
        allocated
      </p>
      <span aria-hidden="true" className="text-ink-muted">
        ·
      </span>
      {unallocated === 0 ? (
        <span className="text-[13px] text-ink-muted">nothing unallocated</span>
      ) : (
        <Badge tone={over ? "danger" : "warning"} size="sm">
          {over ? "▲" : "▼"} {formatWholeCurrency(Math.abs(unallocated), currency)}{" "}
          {over ? "over-allocated" : "unallocated"}
        </Badge>
      )}
      <span className="ml-auto text-[13px] tabular-nums text-ink-muted">{allocatedPercent}%</span>
    </section>
  );
}

StageValueSummaryBar.displayName = "StageValueSummaryBar";

export { StageValueSummaryBar, type StageValueSummaryBarProps };
