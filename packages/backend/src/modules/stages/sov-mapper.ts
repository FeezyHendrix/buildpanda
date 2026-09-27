import { periodBilling } from "./period-billing.ts";
import type {
  PeriodBillingLine,
  StageScheduleOfValue,
  StageScheduleOfValueRow,
} from "./types.ts";

export function percentCompleteOf(row: StageScheduleOfValueRow): number | null {
  return row.percent_complete === null ? null : Number(row.percent_complete);
}

function toScheduleOfValue(
  row: StageScheduleOfValueRow,
  billing: PeriodBillingLine | undefined,
): StageScheduleOfValue {
  return {
    id: row.id,
    stageId: row.stage_id,
    period: row.period,
    percent: Number(row.percent),
    amount: Number(row.amount),
    billed: row.billed,
    sortOrder: row.sort_order,
    percentComplete: percentCompleteOf(row),
    periodPercent: billing?.periodPct ?? 0,
    periodAmount: billing?.periodAmount ?? 0,
    toDateAmount: billing?.toDateAmount ?? 0,
  };
}

/**
 * Prices every line's period figures off its stage's scheduled value. One
 * `periodBilling` per stage, so a project-wide list stays a single pass.
 */
export function toScheduleOfValues(
  rows: StageScheduleOfValueRow[],
  valueByStage: Map<string, number>,
): StageScheduleOfValue[] {
  const byStage = new Map<string, StageScheduleOfValueRow[]>();
  for (const row of rows) {
    const bucket = byStage.get(row.stage_id);
    if (bucket) bucket.push(row);
    else byStage.set(row.stage_id, [row]);
  }
  const billingByKey = new Map<string, PeriodBillingLine>();
  for (const [stageId, stageRows] of byStage) {
    const lines = periodBilling(
      stageRows.map((row) => ({ period: row.period, percentComplete: percentCompleteOf(row) })),
      valueByStage.get(stageId) ?? 0,
    );
    for (const line of lines) billingByKey.set(`${stageId}:${line.period}`, line);
  }
  return rows.map((row) => toScheduleOfValue(row, billingByKey.get(`${row.stage_id}:${row.period}`)));
}

export function recordedBefore(rows: StageScheduleOfValueRow[], period: string): StageScheduleOfValueRow | undefined {
  let found: StageScheduleOfValueRow | undefined;
  for (const row of rows) {
    if (row.period >= period || row.percent_complete === null) continue;
    if (!found || row.period > found.period) found = row;
  }
  return found;
}

export function recordedAfter(rows: StageScheduleOfValueRow[], period: string): StageScheduleOfValueRow | undefined {
  let found: StageScheduleOfValueRow | undefined;
  for (const row of rows) {
    if (row.period <= period || row.percent_complete === null) continue;
    if (!found || row.period < found.period) found = row;
  }
  return found;
}

