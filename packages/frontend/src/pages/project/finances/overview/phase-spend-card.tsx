import { useMemo } from "react";
import { ProgressBar, type ProgressTone } from "@/components/atoms/progress-bar";
import type { StageBudgetLine } from "@/hooks/use-finances";
import { CONTRACTS_PHASES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCompactCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { OverviewCard, OverviewEmpty } from "./overview-cards";

/**
 * Phase spend as a share of budget, read from `GET /finances/summary`. The
 * budget is the phase's estimate where one was entered and its scheduled value
 * otherwise. Nothing is recomputed here beyond the bar width; a phase past
 * 100% is an overrun.
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

function spendTone(percent: number): ProgressTone {
  return percent > 100 ? "danger" : "brand";
}

function PhaseSpendRow({ phase, currency }: { phase: PhaseSpend; currency: string }) {
  const over = phase.percent > 100;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_5rem] items-center gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[13px] text-ink">{phase.name}</p>
        <p className="truncate text-xs text-ink-muted">
          {formatCompactCurrency(phase.actual, currency)} of {formatCompactCurrency(phase.budget, currency)} budget
        </p>
      </div>
      <p className={cn("text-[13px] font-medium tabular-nums", over ? "text-error-600" : "text-ink")}>
        {over ? "▲ " : ""}
        {phase.percent}%
      </p>
      <ProgressBar value={Math.min(100, phase.percent)} tone={spendTone(phase.percent)} size="lg" trackClassName="bg-surface-alt" />
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
        <ul className="divide-y divide-line-hair">
          {rows.map((phase) => (
            <PhaseSpendRow key={phase.stageId} phase={phase} currency={currency} />
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

PhaseSpendCard.displayName = "PhaseSpendCard";
