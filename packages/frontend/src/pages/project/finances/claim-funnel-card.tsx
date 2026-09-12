import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { EmptyState } from "@/components/molecules/empty-state";
import { MilestoneCard } from "@/components/molecules/milestone-card";
import { financeTabPath } from "@/lib/finance-routes";
import type { Currency, MilestoneClaimState, MilestonePayment } from "@/lib/project-types";
import { cn } from "@/lib/utils";

/**
 * How far each stage has moved from "not yet claimable" to "paid". Counts come
 * from the stage's recorded claim state, so the funnel is a reading of the
 * ledger, not a forecast.
 */
const FUNNEL_STEPS: readonly { state: MilestoneClaimState; label: string; marker: string }[] = [
  { state: "pending", label: "Pending", marker: "○" },
  { state: "claimable", label: "Claimable", marker: "◔" },
  { state: "claimed", label: "Claimed", marker: "◑" },
  { state: "certified", label: "Certified", marker: "◕" },
  { state: "paid", label: "Paid", marker: "●" },
];

function FunnelStep({
  label,
  marker,
  count,
  total,
  isLast,
}: {
  label: string;
  marker: string;
  count: number;
  total: number;
  isLast: boolean;
}) {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-black-300">
          <span aria-hidden="true">{marker}</span>
          {label}
        </p>
        <p className="mt-1 text-[22px] font-bold leading-tight tabular-nums text-black-500">{count}</p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
          <div
            className={cn("h-full rounded-full", count > 0 ? "bg-[#004DE7]" : "bg-transparent")}
            style={{ width: `${share}%` }}
          />
        </div>
      </div>
      {isLast ? null : (
        <span aria-hidden="true" className="hidden text-gray-300 lg:block">
          ›
        </span>
      )}
    </div>
  );
}

export interface ClaimFunnelCardProps {
  projectId: string;
  milestones: MilestonePayment[];
  currency: Currency;
  onRequestRelease?: (milestone: MilestonePayment) => void;
  onRequestDispute?: (milestone: MilestonePayment) => void;
}

export function ClaimFunnelCard({
  projectId,
  milestones,
  currency,
  onRequestRelease,
  onRequestDispute,
}: ClaimFunnelCardProps) {
  const counts = useMemo(() => {
    const byState = new Map<MilestoneClaimState, number>();
    for (const m of milestones) byState.set(m.claimState, (byState.get(m.claimState) ?? 0) + 1);
    return byState;
  }, [milestones]);

  return (
    <Card className="mt-6 rounded-[16px] border-none bg-[#F8F8F8] px-0 py-0">
      <div className="flex items-center justify-between px-5 py-3">
        <div>
          <h3 className="text-[13px] font-semibold text-black-300">Stage payments</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Where each of the {milestones.length} stages sits between claimable and paid.
          </p>
        </div>
        <Link
          to={`/project/${projectId}/${financeTabPath("finances/billing", "stage-payments")}`}
          className="rounded-[100px] bg-white px-4 py-1 text-xs font-semibold text-[#004DE7]"
        >
          View more
        </Link>
      </div>

      <div className="m-1 rounded-[12px] bg-white p-5">
        {milestones.length === 0 ? (
          <EmptyState
            variant="inline"
            title="No stage payments yet"
            description="Stages appear here once payments are gated on them."
          />
        ) : (
          <>
            <div className="grid gap-3 rounded-xl bg-[#F8F8F8] p-3 sm:grid-cols-2 lg:grid-cols-5">
              {FUNNEL_STEPS.map((step, idx) => (
                <FunnelStep
                  key={step.state}
                  label={step.label}
                  marker={step.marker}
                  count={counts.get(step.state) ?? 0}
                  total={milestones.length}
                  isLast={idx === FUNNEL_STEPS.length - 1}
                />
              ))}
            </div>
            <div className="mt-4 flex items-stretch gap-4 overflow-x-auto pb-1">
              {milestones.map((milestone, idx) => (
                <MilestoneCard
                  key={`${milestone.id}-${idx}`}
                  milestone={milestone}
                  currency={currency}
                  variant="compact"
                  onReleaseFunds={onRequestRelease ? () => onRequestRelease(milestone) : undefined}
                  onRaiseDispute={onRequestDispute ? () => onRequestDispute(milestone) : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

ClaimFunnelCard.displayName = "ClaimFunnelCard";
