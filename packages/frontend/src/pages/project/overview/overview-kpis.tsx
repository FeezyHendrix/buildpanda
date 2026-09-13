import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { KpiCard, type KpiCardProps } from "@/components/molecules/kpi-card";
import { useChangeRequestSummary } from "@/hooks/use-change-requests";
import { useProjectActivities } from "@/hooks/use-activities";
import { useProjectRfis } from "@/hooks/use-rfis";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { formatWholeCurrency } from "@/lib/formatters";
import type { Activity, Project, ProjectPhase } from "@/lib/project-types";

/** RFI statuses that still count as open work. */
const OPEN_RFI_STATUSES = new Set(["Open", "InReview"]);
/** Points behind the calendar before "Behind plan" reads as danger. */
const BEHIND_DANGER_PTS = 5;
/** Band around zero that still reads as "On track". */
const ON_TRACK_BAND_PTS = 2;
/** Spend running this far ahead of progress is flagged on the budget card. */
const SPEND_AHEAD_PTS = 10;

export interface ScheduleGap {
  /** Calendar fraction of the programme elapsed today, 0–100; null when there is no programme. */
  expectedPercent: number | null;
  /** Actual minus expected, in percentage points; null when there is no programme. */
  gapPts: number | null;
  delayedCount: number;
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/** "Jan 2025 – Mar 2025" → [start, end]; template ranges like "Weeks 1 – 4" parse to nothing. */
function timelineBounds(timeline: ProjectPhase[]): { start: number; end: number } | null {
  let start: number | null = null;
  let end: number | null = null;
  for (const phase of timeline) {
    for (const part of phase.dateRange.split(/\s[–-]\s|\s+to\s+/)) {
      const t = toTime(part.trim());
      if (t === null) continue;
      if (start === null || t < start) start = t;
      if (end === null || t > end) end = t;
    }
  }
  return start !== null && end !== null && end > start ? { start, end } : null;
}

function programmeBounds(activities: Activity[]): { start: number; end: number } | null {
  let start: number | null = null;
  let end: number | null = null;
  for (const a of activities) {
    if (a.status === "Cancelled") continue;
    const s = toTime(a.plannedStartAt);
    const e = toTime(a.plannedEndAt);
    if (s !== null && (start === null || s < start)) start = s;
    if (e !== null && (end === null || e > end)) end = e;
  }
  return start !== null && end !== null && end > start ? { start, end } : null;
}

/**
 * Expected progress is the calendar fraction of the programme elapsed today; the
 * gap is how far actual progress sits from it. Pure so the figures can be checked
 * without rendering.
 */
export function deriveScheduleGap(
  activities: Activity[],
  timeline: ProjectPhase[],
  progressPercent: number,
  today: Date = new Date(),
): ScheduleGap {
  const delayedCount = activities.filter((a) => a.isDelayed && a.status !== "Completed").length;
  const bounds = programmeBounds(activities) ?? timelineBounds(timeline);
  if (!bounds) return { expectedPercent: null, gapPts: null, delayedCount };
  const fraction = (today.getTime() - bounds.start) / (bounds.end - bounds.start);
  const expectedPercent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return { expectedPercent, gapPts: Math.round(progressPercent) - expectedPercent, delayedCount };
}

function formatPts(gap: number): string {
  if (gap === 0) return "0 pts";
  return `${gap > 0 ? "+" : "−"}${Math.abs(gap)} pts`;
}

function scheduleHelper(gap: ScheduleGap): string {
  const parts: string[] = [];
  if (gap.gapPts !== null) {
    parts.push(
      gap.gapPts < -ON_TRACK_BAND_PTS ? "Behind plan" : gap.gapPts > ON_TRACK_BAND_PTS ? "Ahead of plan" : "On track",
    );
  }
  if (gap.delayedCount > 0) {
    parts.push(`${gap.delayedCount} delayed ${gap.delayedCount === 1 ? "activity" : "activities"}`);
  }
  return parts.join(" · ");
}

function pluralise(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** KpiCard renders its value inside a <p>, so a pending card swaps the figure for a centred spinner instead. */
function Kpi({ pending, ...props }: KpiCardProps & { pending?: boolean }) {
  if (!pending) return <KpiCard {...props} />;
  return (
    <Card padding="md" className="flex min-w-0 flex-col gap-3 p-5">
      <p className="text-[13px] font-medium text-black-300">{props.label}</p>
      <div className="flex h-[52px] items-center justify-center">
        <Spinner size="sm" />
      </div>
    </Card>
  );
}

export function OverviewKpis({ project }: { project: Project }) {
  const snapshot = useReportingSnapshot(project.id);
  const activities = useProjectActivities(project.id);
  const rfis = useProjectRfis(project.id);
  const changes = useChangeRequestSummary(project.id);
  const currency = project.currency;

  const phases = project.timeline;
  const phasesDone = phases.filter((p) => p.status === "Done").length;

  const gap = deriveScheduleGap(activities.data ?? [], phases, project.progressPercent);
  const scheduleDanger = (gap.gapPts !== null && gap.gapPts < -BEHIND_DANGER_PTS) || gap.delayedCount > 0;

  const usedPct = project.budgetTotal > 0 ? Math.round((project.budgetUsed / project.budgetTotal) * 100) : null;
  const spendAhead = usedPct !== null && usedPct - project.progressPercent >= SPEND_AHEAD_PTS;

  const budget = snapshot.data?.finance.budget;
  const invoices = snapshot.data?.finance.invoices;
  const pendingChangeValue = snapshot.data?.finance.changeRequests.pendingCostImpact ?? 0;

  const openRfis = (rfis.data ?? []).filter((r) => OPEN_RFI_STATUSES.has(r.status)).length;
  const pendingApprovals = snapshot.data?.operations.pendingApprovals ?? project.pendingApprovals;
  const submittedChanges = changes.data?.submitted ?? 0;
  const openItems = openRfis + pendingApprovals + submittedChanges;
  const openItemsHelper = [
    `${openRfis} RFIs`,
    `${pendingApprovals} approvals`,
    pluralise(submittedChanges, "change order", "change orders"),
  ].join(" · ");

  return (
    <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <div data-tour="construction-progress">
        <KpiCard
          label="Construction progress"
          progress={project.progressPercent}
          helper={`${phasesDone} of ${phases.length} phases complete`}
        />
      </div>
      <Kpi
        pending={activities.isPending}
        label="Schedule"
        value={gap.gapPts === null ? "—" : formatPts(gap.gapPts)}
        helper={gap.gapPts === null ? "No programme yet" : scheduleHelper(gap)}
        tone={scheduleDanger ? "danger" : "default"}
      />
      <div data-tour="construction-budget">
        <KpiCard
          label="Budget used"
          value={formatWholeCurrency(project.budgetUsed, currency)}
          helper={
            usedPct === null
              ? "No budget set"
              : spendAhead
                ? `${usedPct}% used · spending ahead of ${project.progressPercent}% progress`
                : `${usedPct}% of ${formatWholeCurrency(project.budgetTotal, currency)}`
          }
          tone={spendAhead ? "danger" : "default"}
        />
      </div>
      <Kpi
        pending={snapshot.isPending}
        label="Cost variance"
        value={budget ? formatWholeCurrency(budget.totalVariance, currency) : "—"}
        helper={
          budget
            ? pluralise(budget.overBudgetCount, "category over budget", "categories over budget")
            : "Budget not available"
        }
        tone={budget && budget.totalVariance < 0 ? "danger" : "default"}
      />
      <Kpi
        pending={snapshot.isPending}
        label="Cash"
        value={invoices ? formatWholeCurrency(invoices.outstanding, currency) : "—"}
        helper={
          invoices
            ? [
                `invoiced ${formatWholeCurrency(invoices.invoicedTotal, currency)} · paid ${formatWholeCurrency(invoices.paidTotal, currency)}`,
                invoices.overdueCount > 0 ? `${invoices.overdueCount} overdue` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "Invoices not available"
        }
        tone={invoices && invoices.overdueCount > 0 ? "danger" : "default"}
      />
      <div data-tour="construction-approvals">
        <Kpi
          pending={rfis.isPending}
          label="Open items"
          value={openItems}
          helper={
            pendingChangeValue > 0
              ? `${openItemsHelper} · pending change value ${formatWholeCurrency(pendingChangeValue, currency)}`
              : openItemsHelper
          }
        />
      </div>
    </section>
  );
}

OverviewKpis.displayName = "OverviewKpis";
