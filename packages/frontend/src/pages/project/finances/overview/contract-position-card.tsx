import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import type { FinanceSummary } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { isSettled } from "../settlement-statement";
import { ContractStatement } from "./contract-statement";
import { OverviewCard, OverviewList, OverviewRow } from "./overview-cards";

/**
 * The contract position: the adjusted contract sum split into what has been
 * received, what is certified but unpaid, and what is still to certify, as one
 * bar and three rows, with the full statement folded underneath. Every figure
 * is read from `GET /finances/summary`; the only thing computed here is each
 * segment's share of the bar, which is presentation, not a record.
 */

const SEGMENTS = [
  { key: "paid", label: "Paid to date", helper: "Receipts recorded against certificates", swatch: "bg-[#004DE7]", dot: "bg-[#004DE7]" },
  { key: "unpaid", label: "Unpaid certified", helper: "Certified, not yet received", swatch: "bg-[#B0C8F8]", dot: "bg-[#E6EDFD]" },
  { key: "outstanding", label: "Still to certify", helper: "Adjusted contract less certified", swatch: "bg-[#CFCFCF]", dot: "bg-[#737373]" },
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
  const [statementOpen, setStatementOpen] = useState(false);
  const statementId = useId();

  return (
    <OverviewCard
      title="Contract Position"
      to={contractsHref}
      linkLabel="Contracts & Phases"
      className={className}
      bodyClassName="pb-0 pt-[18px]"
      actions={
        isSettled(summary) ? (
          <Badge tone="success" size="sm" dot>
            Settled
          </Badge>
        ) : null
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-[6px] gap-y-1">
        <p className="text-caption-l font-semibold tabular-nums text-[#1E1E1E]">{money(summary.adjustedContract)}</p>
        <p className="text-caption-m text-[#737373]">adjusted contract sum</p>
      </div>

      {/* The track is always there; segments fill it once there is something to split. */}
      <div
        className="mt-[7px] flex h-[8px] w-full gap-0.5 overflow-hidden bg-[#E5E5E5]"
        role="img"
        aria-label="Share of the adjusted contract paid, certified but unpaid, and still to certify"
      >
        {SEGMENTS.map((segment) =>
          shares[segment.key] > 0 ? <div key={segment.key} className={cn("h-full", segment.swatch)} style={{ width: `${shares[segment.key]}%` }} /> : null,
        )}
      </div>

      <OverviewList className="mt-[6px]">
        {SEGMENTS.map((segment) => (
          <OverviewRow
            key={segment.key}
            tall
            marker={<span className={cn("block size-[12px] rounded-full", segment.dot)} />}
            label={segment.label}
            sub={segment.helper}
            value={money(amounts[segment.key])}
            helper={`${shares[segment.key]}% of contract`}
          />
        ))}
      </OverviewList>

      <div className="border-t border-[#EEEEEE]">
        <button
          type="button"
          onClick={() => setStatementOpen((open) => !open)}
          aria-expanded={statementOpen}
          aria-controls={statementId}
          className="flex h-[58px] w-full items-center justify-between gap-3 text-left text-caption-l font-medium text-[#1E1E1E] outline-none focus-visible:underline"
        >
          Full Statement
          {statementOpen ? <ChevronUp className="size-[18px]" aria-hidden /> : <ChevronDown className="size-[18px]" aria-hidden />}
        </button>
        {statementOpen ? (
          <div id={statementId}>
            <ContractStatement summary={summary} />
          </div>
        ) : null}
      </div>
    </OverviewCard>
  );
}

ContractPositionCard.displayName = "ContractPositionCard";
