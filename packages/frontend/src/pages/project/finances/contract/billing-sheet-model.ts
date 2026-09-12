import type { StageScheduleOfValue } from "@/hooks/use-stages";
import { Money } from "@/lib/money";
import type { MilestoneClaimState, MilestonePayment, Stage } from "@/lib/project-types";

/**
 * Pure shaping for the billing sheet: one row per stage, one column per
 * billing month. Every figure a cell shows is priced by the backend
 * (`periodAmount`, `toDateAmount`); the model only arranges them and sums
 * the totals row.
 */

/** What `useStageCosts` reports per stage (committed POs, actual spend). */
export interface StageCost {
  committed: number;
  actual: number;
}
export type StageCosts = Record<string, StageCost>;

export interface SheetRow {
  stage: Stage;
  /** Build-order position, so numbering survives a search filter. */
  index: number;
  /** From the stage payment bound to this stage (by phase name); null when none. */
  claimState: MilestoneClaimState | null;
  cost: StageCost | undefined;
  /** This stage's lines keyed by period. */
  cells: Map<string, StageScheduleOfValue>;
  /** The latest recorded month: cumulative % and the amount reached to date. */
  toDate: { percent: number | null; amount: number };
}

export interface SheetTotals {
  scheduled: number;
  committed: number;
  actual: number;
  variance: number;
  byPeriod: Map<string, number>;
  toDate: number;
}

export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export type SheetGroupId = "main" | "change_orders";

/** Rows grouped by the contract that prices them; each group carries its own subtotal. */
export interface SheetGroup {
  id: SheetGroupId;
  label: string;
  rows: SheetRow[];
  totals: SheetTotals;
}

const GROUP_LABELS: Record<SheetGroupId, string> = {
  main: "Original contract",
  change_orders: "Change orders",
};

/**
 * Splits the rows into the original contract and the change orders by the
 * stage's `contractId`. A stage with no contract (or one the contracts list
 * does not know) belongs to the original contract. The change-orders group is
 * kept even when empty once a change-order contract exists, so the section
 * reads the same before and after its first phase is assigned.
 */
export function groupRowsByContract(
  rows: SheetRow[],
  periods: string[],
  changeOrderContractIds: ReadonlySet<string>,
): SheetGroup[] {
  const main: SheetRow[] = [];
  const changeOrders: SheetRow[] = [];
  for (const row of rows) {
    const contractId = row.stage.contractId;
    if (contractId && changeOrderContractIds.has(contractId)) changeOrders.push(row);
    else main.push(row);
  }
  const groups: SheetGroup[] = [
    { id: "main", label: GROUP_LABELS.main, rows: main, totals: sheetTotals(main, periods) },
  ];
  if (changeOrders.length > 0 || changeOrderContractIds.size > 0) {
    groups.push({
      id: "change_orders",
      label: GROUP_LABELS.change_orders,
      rows: changeOrders,
      totals: sheetTotals(changeOrders, periods),
    });
  }
  return groups;
}

export function groupLinesByStage(
  lines: StageScheduleOfValue[] | undefined,
): Map<string, StageScheduleOfValue[]> {
  const map = new Map<string, StageScheduleOfValue[]>();
  for (const line of lines ?? []) {
    const rows = map.get(line.stageId);
    if (rows) rows.push(line);
    else map.set(line.stageId, [line]);
  }
  return map;
}

/** Every month any stage bills in, plus the ones added on screen, in calendar order. */
export function sheetPeriods(
  lines: StageScheduleOfValue[] | undefined,
  extra: readonly string[],
): string[] {
  const set = new Set<string>(extra);
  for (const line of lines ?? []) set.add(line.period);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Months with a progress invoice raised: any stage line flagged billed. */
export function invoicedPeriods(lines: StageScheduleOfValue[] | undefined): Set<string> {
  const set = new Set<string>();
  for (const line of lines ?? []) if (line.billed) set.add(line.period);
  return set;
}

function toDateOf(lines: StageScheduleOfValue[]): SheetRow["toDate"] {
  let latest: StageScheduleOfValue | undefined;
  for (const line of lines) {
    if (line.percentComplete === null) continue;
    if (!latest || line.period > latest.period) latest = line;
  }
  return latest
    ? { percent: latest.percentComplete, amount: latest.toDateAmount }
    : { percent: null, amount: 0 };
}

export function buildSheetRows(
  stages: Stage[],
  linesByStage: Map<string, StageScheduleOfValue[]>,
  milestones: MilestonePayment[] | undefined,
  costs: StageCosts | undefined,
): SheetRow[] {
  // Stage payments bind to a stage by name (finances claim chain).
  const claimByPhase = new Map<string, MilestoneClaimState>();
  for (const milestone of milestones ?? []) {
    if (!claimByPhase.has(milestone.phase)) claimByPhase.set(milestone.phase, milestone.claimState);
  }
  return stages.map((stage, index) => {
    const lines = linesByStage.get(stage.id) ?? [];
    return {
      stage,
      index,
      claimState: claimByPhase.get(stage.name) ?? null,
      cost: costs?.[stage.id],
      cells: new Map(lines.map((line) => [line.period, line])),
      toDate: toDateOf(lines),
    };
  });
}

/** Scheduled value less actual cost — what the stage has left after spend. */
export function stageVariance(stage: Stage, cost: StageCost | undefined): number | undefined {
  if (!cost) return undefined;
  return Money.of(stage.value).sub(cost.actual).round(2).toNumber();
}

export function sheetTotals(rows: SheetRow[], periods: string[]): SheetTotals {
  const byPeriod = new Map<string, number>();
  for (const period of periods) {
    byPeriod.set(
      period,
      Money.sum(rows.map((row) => row.cells.get(period)?.periodAmount ?? 0)).round(2).toNumber(),
    );
  }
  const scheduled = Money.sum(rows.map((row) => row.stage.value));
  const actual = Money.sum(rows.map((row) => row.cost?.actual ?? 0));
  return {
    scheduled: scheduled.round(2).toNumber(),
    committed: Money.sum(rows.map((row) => row.cost?.committed ?? 0)).round(2).toNumber(),
    actual: actual.round(2).toNumber(),
    variance: scheduled.sub(actual).round(2).toNumber(),
    byPeriod,
    toDate: Money.sum(rows.map((row) => row.toDate.amount)).round(2).toNumber(),
  };
}

/** "2026-03" -> "Mar 2026". */
export function formatPeriodHeading(period: string): string {
  if (!PERIOD_PATTERN.test(period)) return period;
  const date = new Date(`${period}-01T00:00:00`);
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function formatCumulative(percent: number | null): string {
  if (percent === null) return "—";
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

/**
 * What a typed cell value means: `null` clears the month, a number records it,
 * `"invalid"` is anything outside 0–100. Kept to one decimal, like the sheet shows.
 */
export function parseCellPercent(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 100) return "invalid";
  return Math.round(value * 10) / 10;
}
