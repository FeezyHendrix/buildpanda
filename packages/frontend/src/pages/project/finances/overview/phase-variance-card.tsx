import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { useStages } from "@/hooks/use-stages";
import { CONTRACTS_PHASES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCurrency } from "@/lib/formatters";
import { Money } from "@/lib/money";
import type { Currency, Stage } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { OverviewCard, OverviewEmpty } from "./overview-cards";

/**
 * Phases: cost vs budget — the phases furthest from their estimate. Variance
 * is what the phase was expected to cost less what it has cost so far
 * (the scheduled value stands in when no estimate was typed), so a negative
 * figure is an overrun.
 */

const TOP_N = 5;

interface PhaseVarianceRow {
  stage: Stage;
  estimate: number;
  cost: number;
  variance: number;
}

export function rankPhasesByVariance(stages: Stage[]): PhaseVarianceRow[] {
  const rows = stages
    .filter((stage) => stage.totalCost != null || stage.expectedCost != null)
    .map((stage) => {
      const estimate = stage.expectedCost ?? stage.value;
      const cost = stage.totalCost ?? 0;
      return { stage, estimate, cost, variance: Money.of(estimate).sub(cost).round(2).toNumber() };
    });
  // A fresh array from `map`, so sorting in place never touches the cached stages.
  return rows.sort((a, b) => a.variance - b.variance).slice(0, TOP_N);
}

interface PhaseVarianceCardProps {
  projectId: string;
  currency: Currency;
}

export function PhaseVarianceCard({ projectId, currency }: PhaseVarianceCardProps) {
  const { data: stages = [] } = useStages(projectId);
  const rows = useMemo(() => rankPhasesByVariance(stages), [stages]);

  return (
    <OverviewCard
      title="Phases: cost vs budget"
      description="The phases furthest from their estimate; a negative variance is an overrun."
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
                <TableHeaderCell align="right">Est. total costs</TableHeaderCell>
                <TableHeaderCell align="right">Total costs</TableHeaderCell>
                <TableHeaderCell align="right">Variance</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map(({ stage, estimate, cost, variance }) => (
                <TableRow key={stage.id}>
                  <TableCell className="font-medium text-ink">{stage.name}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">{formatCurrency(stage.value, currency)}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">{formatCurrency(estimate, currency)}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">{formatCurrency(cost, currency)}</TableCell>
                  <TableCell
                    align="right"
                    className={cn("whitespace-nowrap font-semibold tabular-nums", variance < 0 ? "text-error-600" : "text-success-500")}
                  >
                    {variance < 0 ? "▼ " : "▲ "}
                    {formatCurrency(variance, currency, { signed: true })}
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
