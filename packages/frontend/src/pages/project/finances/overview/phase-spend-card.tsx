import { useMemo } from "react";
import type { StageBudgetLine } from "@/hooks/use-finances";
import { CONTRACTS_PHASES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCompactCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { OverviewCard, OverviewEmpty } from "./overview-cards";

/**
 * Phase spend as a share of budget, read from `GET /finances/summary`. The
 * budget is the phase's estimate where one was entered and its scheduled value
 * otherwise. Nothing is recomputed here; a phase past 100% is an overrun.
 *
 * Contractor cost, so the card only renders with `finances:viewCosts`.
 */

const TOP_N = 6;

interface PhaseSpend {
  stageId: string;
  name: string;
  actual: number;
  budget: number;
  /** Actual as a share of budget, unclamped so an overrun reads past 100. */
  percent: number;
}

export function rankPhasesBySpend(phases: StageBudgetLine[]): PhaseSpend[] {
  return phases
    .filter((phase) => phase.budget > 0 || phase.actual > 0)
    .map((phase) => ({
      stageId: phase.stageId,
      name: phase.name,
      actual: phase.actual,
      budget: phase.budget,
      percent: phase.budget > 0 ? Math.round((phase.actual / phase.budget) * 100) : phase.actual > 0 ? 100 : 0,
    }))
    // `map` already returned a fresh array, so sorting it never touches the cache.
    .sort((a, b) => b.percent - a.percent)
    .slice(0, TOP_N);
}

function PhaseSpendRow({ phase, currency }: { phase: PhaseSpend; currency: string }) {
  const over = phase.percent > 100;
  return (
    <li className="flex min-h-[60px] items-center justify-between gap-3 py-[10px]">
      <div className="min-w-0">
        <p className="truncate text-caption-l text-[#1E1E1E]">{phase.name}</p>
        <p className="truncate text-caption-m text-[#737373]">
          {formatCompactCurrency(phase.actual, currency)} of {formatCompactCurrency(phase.budget, currency)} budget
        </p>
      </div>
      {/* A phase past its budget reads past 100%, flagged in red. */}
      <p className={cn("shrink-0 text-[16px] font-medium leading-[24px] tabular-nums", over ? "text-error-600" : "text-[#1E1E1E]")}>
        {over ? "▲ " : ""}
        {phase.percent}%
      </p>
    </li>
  );
}

PhaseSpendRow.displayName = "PhaseSpendRow";

interface PhaseSpendCardProps {
  projectId: string;
  currency: string;
  phases: StageBudgetLine[];
  className?: string;
}

export function PhaseSpendCard({ projectId, currency, phases, className }: PhaseSpendCardProps) {
  const rows = useMemo(() => rankPhasesBySpend(phases), [phases]);

  return (
    <OverviewCard title="Phase spend" to={`/project/${projectId}/${financeTabPath(CONTRACTS_PHASES_PATH, "phases")}`} className={className}>
      {rows.length === 0 ? (
        <OverviewEmpty>No phase costs recorded yet.</OverviewEmpty>
      ) : (
        <ul className="divide-y divide-[#EEEEEE]">
          {rows.map((phase) => (
            <PhaseSpendRow key={phase.stageId} phase={phase} currency={currency} />
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

PhaseSpendCard.displayName = "PhaseSpendCard";
