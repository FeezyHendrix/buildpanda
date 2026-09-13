import type { StageBudgetLine } from "../finances/contract-types.ts";
import type { BudgetCategoryPoint, CashFlowPoint } from "./types.ts";

/**
 * The overview's cost position, built from the same figures the finance pages
 * already publish.
 *
 * The budget block used to read `project_budget_categories` — a sheet somebody
 * has to type into by hand, which on a live job is empty, so the overview
 * reported ₦0 spent while the billing sheet showed ₦26.9m. Cost is recorded
 * against stages (`project_transactions.stage_id`, purchase-order commitments),
 * and that is what the finance summary reports, so the overview reads the same
 * stage lines rather than a parallel sheet.
 */

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** A stage is a budget line: its budget is the estimate, or its scheduled value. */
export function stageBudgetPoints(lines: StageBudgetLine[]): BudgetCategoryPoint[] {
  return lines.map((line) => ({
    id: line.stageId,
    name: line.name,
    // A stage carries no cost code; the billing sheet identifies it by name.
    costCode: null,
    planned: round2(line.budget),
    committed: round2(line.committed),
    actual: round2(line.actual),
    // Keep the finance summary's definition: commitments are money already
    // promised, so they eat the budget alongside what has been spent.
    variance: round2(line.variance),
  }));
}

/** True once a stage line carries any money at all — otherwise fall back. */
export function hasStageFigures(points: BudgetCategoryPoint[]): boolean {
  return points.some((p) => p.planned !== 0 || p.committed !== 0 || p.actual !== 0);
}

export interface MonthAmount {
  period: string;
  amount: number;
}

/**
 * The cash-flow S-curve: planned against actual, by month, cumulative.
 *
 * Planned is what the programme or the billing sheet says should be billed in
 * the month; actual is the cost logged in it. Both are records, never movements.
 */
export function cashFlowCurve(planned: MonthAmount[], actual: MonthAmount[]): CashFlowPoint[] {
  const plannedByPeriod = new Map(planned.map((p) => [p.period, p.amount]));
  const actualByPeriod = new Map(actual.map((p) => [p.period, p.amount]));
  const periods = [...new Set([...plannedByPeriod.keys(), ...actualByPeriod.keys()])].sort();

  let cumulativePlanned = 0;
  let cumulativeActual = 0;
  return periods.map((period) => {
    const plannedAmount = round2(plannedByPeriod.get(period) ?? 0);
    const actualAmount = round2(actualByPeriod.get(period) ?? 0);
    cumulativePlanned = round2(cumulativePlanned + plannedAmount);
    cumulativeActual = round2(cumulativeActual + actualAmount);
    return {
      period,
      planned: plannedAmount,
      actual: actualAmount,
      cumulativePlanned,
      cumulativeActual,
    };
  });
}

/** Sum amounts that share a month into one entry. */
export function sumByPeriod(rows: Array<{ period: string; amount: number }>): MonthAmount[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.period) continue;
    totals.set(row.period, round2((totals.get(row.period) ?? 0) + row.amount));
  }
  return [...totals.entries()].map(([period, amount]) => ({ period, amount }));
}
