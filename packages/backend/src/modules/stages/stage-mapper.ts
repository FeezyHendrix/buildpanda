import { EMPTY_USAGE, type PhaseRollup } from "./phase-rollup.ts";
import type { Stage, StageRow } from "./types.ts";

function fmt(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function deriveDateRange(start: string | null, end: string | null): string | null {
  const s = fmt(start);
  const e = fmt(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `From ${s}`;
  if (e) return `Until ${e}`;
  return null;
}

export function clampPercent(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export const EMPTY_ROLLUP: PhaseRollup = { usageByStage: new Map(), mainContractId: null };

/** The single row → DTO mapper; used figures come from the project roll-up. */
export function toStage(row: StageRow, rollup: PhaseRollup = EMPTY_ROLLUP): Stage {
  const usage = rollup.usageByStage.get(row.id) ?? EMPTY_USAGE;
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    dateRange: row.date_range,
    progressPercent: row.progress_percent,
    value: Number(row.value),
    sortOrder: row.sort_order,
    contractId: row.contract_id ?? rollup.mainContractId,
    expectedCost: Number(row.expected_cost ?? 0),
    estimatedLaborHours: Number(row.estimated_labor_hours ?? 0),
    laborBudget: Number(row.labor_budget ?? 0),
    materialBudget: Number(row.material_budget ?? 0),
    usedLaborHours: usage.usedLaborHours,
    usedMaterialCost: usage.usedMaterialCost,
    totalCost: usage.totalCost,
  };
}
