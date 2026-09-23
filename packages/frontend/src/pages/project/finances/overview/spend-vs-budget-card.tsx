import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Spinner } from "@/components/atoms/spinner";
import { SimpleDropdown } from "@/components/molecules/simple-dropdown";
import type { CashFlowPoint } from "@/hooks/use-reporting-snapshot";
import { BUDGET_INVOICES_PATH } from "@/lib/finance-routes";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { OverviewCard, OverviewEmpty } from "./overview-cards";

/**
 * Cumulative spend against cumulative budget, month by month, from the
 * reporting snapshot's cash-flow curve: budget is what the billing sheet or
 * programme says should be spent by each month, spend is the cost logged in
 * it. Both are records. The card only picks a window and draws the lines.
 */

const RANGES = [
  { value: "6", label: "Last 6 months" },
  { value: "12", label: "Last 12 months" },
  { value: "all", label: "All time" },
] as const;
type Range = (typeof RANGES)[number]["value"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const index = Number(month) - 1;
  if (!year || !MONTHS[index]) return period;
  return `${MONTHS[index]} '${year.slice(2)}`;
}

export interface SpendPoint {
  period: string;
  /** Cumulative cost logged by the end of this month. */
  spent: number;
  /** Cumulative cost the programme says should have been spent by then. */
  budgeted: number;
}

/**
 * Spend comes from the expense ledger, budget from the programme's own cost
 * phasing. They are kept apart on purpose: the schedule of values is a BILLING
 * schedule, what the employer is certified, and plotting it against cost would
 * compare revenue to spend and quietly overstate the budget by the margin.
 */
export function mergeSeries(spend: CashFlowPoint[], budget: CashFlowPoint[] | null | undefined): SpendPoint[] {
  const byPeriod = new Map<string, SpendPoint>();
  const at = (period: string): SpendPoint => {
    let row = byPeriod.get(period);
    if (!row) {
      row = { period, spent: 0, budgeted: 0 };
      byPeriod.set(period, row);
    }
    return row;
  };
  for (const point of spend) at(point.period).spent = point.cumulativeActual;
  // Without a phased cost budget the curve's own planned figures stand in.
  const budgetSource = budget && budget.length > 0 ? budget : spend;
  for (const point of budgetSource) at(point.period).budgeted = point.cumulativePlanned;
  return [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
}

/** The last N months of the curve, or all of it. */
export function windowPoints(points: SpendPoint[], range: Range): SpendPoint[] {
  if (range === "all") return points;
  return points.slice(-Number(range));
}

const SERIES = [
  { key: "spent", label: "Spent", swatch: "bg-primary-500", stroke: "var(--color-primary-500)", dash: undefined },
  { key: "budgeted", label: "Budgeted", swatch: "border border-dashed border-ink-muted", stroke: "var(--color-ink-muted)", dash: "4 4" },
] as const;

function Legend() {
  return (
    <div className="flex items-center gap-4">
      {SERIES.map((series) => (
        <span key={series.key} className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span aria-hidden="true" className={cn("size-2 rounded-full", series.swatch)} />
          {series.label}
        </span>
      ))}
    </div>
  );
}

Legend.displayName = "Legend";

interface TooltipPayload {
  dataKey?: string;
  value?: number | string;
}

function SpendTooltip({ active, payload, label, currency }: { active?: boolean; payload?: TooltipPayload[]; label?: string; currency: string }) {
  if (!active || !payload?.length) return null;
  const byKey = new Map(payload.map((entry) => [entry.dataKey, Number(entry.value ?? 0)]));
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-ink">{label}</p>
      {SERIES.map((series) => (
        <p key={series.key} className="mt-0.5 flex items-center justify-between gap-4 text-ink-muted">
          <span>{series.label}</span>
          <span className="tabular-nums text-ink">{formatCurrency(byKey.get(series.key) ?? 0, currency)}</span>
        </p>
      ))}
    </div>
  );
}

SpendTooltip.displayName = "SpendTooltip";

interface SpendVsBudgetCardProps {
  projectId: string;
  currency: string;
  /** Cash-flow points from the reporting snapshot; supplies the spend line. */
  points: CashFlowPoint[];
  /** The programme's phased cost budget; supplies the budget line. */
  budgetCurve?: CashFlowPoint[] | null;
  budgetTotal: number;
  spentTotal: number;
  isLoading?: boolean;
  className?: string;
}

export function SpendVsBudgetCard({ projectId, currency, points, budgetCurve, budgetTotal, spentTotal, isLoading, className }: SpendVsBudgetCardProps) {
  const [range, setRange] = useState<Range>("12");
  const merged = useMemo(() => mergeSeries(points, budgetCurve), [points, budgetCurve]);
  const data = useMemo(
    () => windowPoints(merged, range).map((point) => ({ ...point, label: formatPeriod(point.period) })),
    [merged, range],
  );

  return (
    <OverviewCard
      title="Spend vs budget"
      to={`/project/${projectId}/${BUDGET_INVOICES_PATH}`}
      linkLabel="Budget"
      className={className}
      actions={<SimpleDropdown options={RANGES} value={range} onChange={setRange} ariaLabel="Period" />}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xl font-semibold leading-tight text-ink">{formatCurrency(spentTotal, currency)}</p>
        <p className="text-xs text-ink-muted">
          spent of <span className="font-medium text-ink">{formatCurrency(budgetTotal, currency)}</span> budgeted
        </p>
        <Legend />
      </div>

      <div className="mt-3 h-[240px] w-full">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : data.length === 0 ? (
          <OverviewEmpty>No costs logged yet. Expenses appear here month by month once recorded.</OverviewEmpty>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--color-line-hair)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }} tickLine={false} axisLine={false} dy={6} />
              <YAxis
                tickFormatter={(value: number) => formatCompactCurrency(value, currency)}
                tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip content={<SpendTooltip currency={currency} />} cursor={{ stroke: "var(--color-line)" }} />
              {SERIES.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  stroke={series.stroke}
                  strokeWidth={2}
                  strokeDasharray={series.dash}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-surface)" }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </OverviewCard>
  );
}

SpendVsBudgetCard.displayName = "SpendVsBudgetCard";
