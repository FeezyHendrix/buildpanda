import { Badge } from "@/components/atoms/badge";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import type { FinanceSummary } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { SettlementStatement, isSettled } from "../settlement-statement";
import { OverviewCard, OverviewList, OverviewRow } from "./overview-cards";

/**
 * The contract position: the adjusted contract sum split into what has been
 * received, what is certified but unpaid, and what is still to certify, as one
 * bar and three rows, with the full statement folded underneath. Every figure
 * is read from `GET /finances/summary`; the only thing computed here is each
 * segment's share of the bar, which is presentation, not a record.
 */

const SEGMENTS = [
  { key: "paid", label: "Paid to date", helper: "Receipts recorded against certificates", swatch: "bg-primary-500" },
  { key: "unpaid", label: "Unpaid certified", helper: "Certified, not yet received", swatch: "bg-primary-100" },
  { key: "outstanding", label: "Still to certify", helper: "Adjusted contract less certified", swatch: "border border-line bg-surface-alt" },
] as const;
type SegmentKey = (typeof SEGMENTS)[number]["key"];

export function segmentAmounts(summary: FinanceSummary): Record<SegmentKey, number> {
  return {
    paid: Math.max(0, summary.amountPaidToDate),
    unpaid: Math.max(0, summary.unpaidCertified),
    outstanding: Math.max(0, summary.outstanding),
  };
}

/** Each segment's share of the bar, in whole percent; the bar is presentation only. */
export function segmentShares(summary: FinanceSummary): Record<SegmentKey, number> {
  const amounts = segmentAmounts(summary);
  const total = amounts.paid + amounts.unpaid + amounts.outstanding;
  const share = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  return { paid: share(amounts.paid), unpaid: share(amounts.unpaid), outstanding: share(amounts.outstanding) };
}

interface ContractPositionCardProps {
  summary: FinanceSummary;
  contractsHref: string;
  className?: string;
}

export function ContractPositionCard({ summary, contractsHref, className }: ContractPositionCardProps) {
  const amounts = segmentAmounts(summary);
  const shares = segmentShares(summary);
  const money = (value: number) => formatCurrency(value, summary.currency);
  const hasBar = amounts.paid + amounts.unpaid + amounts.outstanding > 0;

  return (
    <OverviewCard
      title="Contract position"
      to={contractsHref}
      linkLabel="Contracts & phases"
      className={className}
      actions={
        isSettled(summary) ? (
          <Badge tone="success" size="sm" dot>
            Settled
          </Badge>
        ) : null
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-xl font-semibold leading-tight text-ink">{money(summary.adjustedContract)}</p>
        <p className="text-xs text-ink-muted">adjusted contract sum</p>
      </div>

      {hasBar ? (
        <div className="mt-3 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Share of the adjusted contract paid, certified but unpaid, and still to certify">
          {SEGMENTS.map((segment) =>
            shares[segment.key] > 0 ? (
              <div key={segment.key} className={cn("h-full rounded-full", segment.swatch)} style={{ width: `${shares[segment.key]}%` }} />
            ) : null,
          )}
        </div>
      ) : null}

      <OverviewList className="mt-2">
        {SEGMENTS.map((segment) => (
          <OverviewRow
            key={segment.key}
            marker={<span className={cn("block size-2 rounded-full", segment.swatch)} />}
            label={segment.label}
            sub={segment.helper}
            value={money(amounts[segment.key])}
            helper={`${shares[segment.key]}% of contract`}
          />
        ))}
      </OverviewList>

      <details className="group mt-2 border-t border-line-hair pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-ink [&::-webkit-details-marker]:hidden">
          Full statement
          <ChevronRightIcon className="size-4 text-ink-muted transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-3">
          <SettlementStatement summary={summary} />
        </div>
      </details>
    </OverviewCard>
  );
}

ContractPositionCard.displayName = "ContractPositionCard";
