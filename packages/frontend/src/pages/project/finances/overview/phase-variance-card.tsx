import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import type { StageBudgetLine } from "@/hooks/use-finances";
import { CONTRACTS_PHASES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { OverviewCard, OverviewEmpty } from "./overview-cards";

/**
 * Phases: cost vs budget, read from `GET /finances/summary`. The budget is the
 * phase's estimate where one was entered and its scheduled value otherwise —
 * which is why the row says where the figure came from. Nothing is recomputed
 * here; a negative variance is an overrun.
 *
 * Contractor cost, so the card only renders with `finances:viewCosts`.
 */

const TOP_N = 5;

/** Worst variance first; a fresh array so the cached summary is never sorted in place. */
export function rankPhasesByVariance(phases: StageBudgetLine[]): StageBudgetLine[] {
  // `filter` already returns a fresh array, so sorting it never touches the cache.
  return phases
    .filter((phase) => phase.committed > 0 || phase.actual > 0 || phase.budget > 0)
    .sort((a, b) => a.variance - b.variance)
    .slice(0, TOP_N);
}

interface PhaseVarianceCardProps {
  projectId: string;
  currency: string;
  phases: StageBudgetLine[];
}

export function PhaseVarianceCard({ projectId, currency, phases }: PhaseVarianceCardProps) {
  const rows = useMemo(() => rankPhasesByVariance(phases), [phases]);

  return (
    <OverviewCard
      title="Phases: cost vs budget"
      description="The phases furthest from their budget; a negative variance is an overrun. Where no estimate was entered the phase's scheduled value is the budget."
      to={`/project/${projectId}/${financeTabPath(CONTRACTS_PHASES_PATH, "phases")}`}
    >
      {rows.length === 0 ? (
        <OverviewEmpty>No phase costs recorded yet — estimates and spend appear here once logged.</OverviewEmpty>
      ) : (
        <div className="-mx-6 -mb-6 overflow-hidden rounded-b-2xl border-t border-line-hair">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Phase</TableHeaderCell>
                <TableHeaderCell align="right">Scheduled value</TableHeaderCell>
                <TableHeaderCell align="right">Budget</TableHeaderCell>
                <TableHeaderCell align="right">Committed</TableHeaderCell>
                <TableHeaderCell align="right">Actual</TableHeaderCell>
                <TableHeaderCell align="right">Variance</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((phase) => (
                <TableRow key={phase.stageId}>
                  <TableCell className="font-medium text-ink">{phase.name}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">
                    {formatCurrency(phase.scheduledValue, currency)}
                  </TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">
                    {formatCurrency(phase.budget, currency)}
                    {phase.budgetSource === "scheduled_value" ? (
                      <Badge tone="neutral" size="sm" className="ml-2">
                        from value
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">
                    {formatCurrency(phase.committed, currency)}
                  </TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">
                    {formatCurrency(phase.actual, currency)}
                  </TableCell>
                  <TableCell
                    align="right"
                    className={cn(
                      "whitespace-nowrap font-semibold tabular-nums",
                      phase.variance < 0 ? "text-error-600" : "text-success-500",
                    )}
                  >
                    {phase.variance < 0 ? "▼ " : "▲ "}
                    {formatCurrency(phase.variance, currency, { signed: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </OverviewCard>
  );
}

PhaseVarianceCard.displayName = "PhaseVarianceCard";
