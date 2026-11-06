import { useChangeRequestSummary } from "@/hooks/use-change-requests";
import { useFinancePosition } from "@/hooks/use-finances";
import { useProjectActivities } from "@/hooks/use-activities";
import { useProjectRfis } from "@/hooks/use-rfis";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { formatWholeCurrency } from "@/lib/formatters";
import { useProjectContext } from "@/layouts/project-layout";
import type { Activity, Project, ProjectPhase } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { isRfiOverdue } from "@/lib/rfi-meta";
import { OverviewStatCard } from "./overview-stat-card";

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

function scheduleHelperTone(gap: ScheduleGap): "muted" | "positive" | "negative" {
  if (gap.gapPts === null) return "muted";
  if (gap.gapPts < -ON_TRACK_BAND_PTS || gap.delayedCount > 0) return "negative";
  return "positive";
}

export function OverviewKpis({ project, className }: { project: Project; className?: string }) {
  const { access } = useProjectContext();
  const snapshot = useReportingSnapshot(project.id);
  const activities = useProjectActivities(project.id);
  const rfis = useProjectRfis(project.id);
  const changes = useChangeRequestSummary(project.id);
  // The one money model: this card and the finance overview read the same
  // figures, so the two pages can never give different answers to "how much
  // have we certified and been paid".
  const position = useFinancePosition(project.id);
  const canViewCosts = access?.capabilities?.canViewCosts ?? false;
  const currency = project.currency;

  const phases = project.timeline;
  const phasesDone = phases.filter((p) => p.status === "Done").length;

  const gap = deriveScheduleGap(activities.data ?? [], phases, project.progressPercent);
  const scheduleDanger = (gap.gapPts !== null && gap.gapPts < -BEHIND_DANGER_PTS) || gap.delayedCount > 0;

  const budget = snapshot.data?.finance.budget;
  // Spend is what the cost ledger holds, not `projects.budget_used` — a column
  // written once at creation and never again, which is why this read ₦0 against
  // a billing sheet showing millions. The budget it is measured against is the
  // same stage budget the finance summary uses.
  const budgetUsed = budget?.totalActual ?? 0;
  const budgetTotal = budget?.totalPlanned ?? project.budgetTotal;
  const usedPct = budgetTotal > 0 ? Math.round((budgetUsed / budgetTotal) * 100) : null;
  const spendAhead = usedPct !== null && usedPct - project.progressPercent >= SPEND_AHEAD_PTS;

  const money = position.data;
  const pendingChangeValue = snapshot.data?.finance.changeRequests.pendingCostImpact ?? 0;

  const openRfiList = (rfis.data ?? []).filter((r) => OPEN_RFI_STATUSES.has(r.status));
  const openRfis = openRfiList.length;
  const overdueRfis = openRfiList.filter((r) => isRfiOverdue(r)).length;
  // Material approvals are approvals too; they were invisible on this tile (#48).
  const pendingApprovals =
    (snapshot.data?.operations.pendingApprovals ?? project.pendingApprovals) +
    (snapshot.data?.operations.pendingMaterialApprovals ?? 0);
  const submittedChanges = changes.data?.submitted ?? 0;
  const openItems = openRfis + pendingApprovals + submittedChanges;
  const openItemsHelper = [
    overdueRfis > 0 ? `${openRfis} RFIs (${overdueRfis} overdue)` : `${openRfis} RFIs`,
    `${pendingApprovals} approvals`,
    pluralise(submittedChanges, "change order", "change orders"),
  ].join(" · ");

  return (
    <section className={cn("grid grid-cols-1 gap-[23px] sm:grid-cols-2 lg:grid-cols-3", className)}>
      <OverviewStatCard
        dataTour="construction-progress"
        label="Construction Progress"
        progress={project.progressPercent}
        helper={`${phasesDone} of ${phases.length} phases complete`}
      />
      <OverviewStatCard
        pending={activities.isPending}
        label="Schedule"
        value={gap.gapPts === null ? "—" : formatPts(gap.gapPts)}
        helper={gap.gapPts === null ? "No programme yet" : scheduleHelper(gap)}
        helperTone={scheduleHelperTone(gap)}
        tone={scheduleDanger ? "danger" : "default"}
      />
      {canViewCosts ? (
        <OverviewStatCard
          dataTour="construction-budget"
          label="Budget Used"
          value={budget ? formatWholeCurrency(budgetUsed, currency) : "—"}
          helper={
            usedPct === null
              ? "No budget set"
              : spendAhead
                ? `${usedPct}% used · spending ahead of ${project.progressPercent}% progress`
                : `${usedPct}% of ${formatWholeCurrency(budgetTotal, currency)}`
          }
          helperTone={spendAhead ? "negative" : "muted"}
          tone={spendAhead ? "danger" : "default"}
        />
      ) : null}
      {canViewCosts ? (
        <OverviewStatCard
          pending={snapshot.isPending}
          label="Cost Variance"
          value={budget ? formatWholeCurrency(budget.totalVariance, currency) : "—"}
          helper={
            budget
              ? pluralise(budget.overBudgetCount, "category over budget", "categories over budget")
              : "Budget not available"
          }
          tone={budget && budget.totalVariance < 0 ? "danger" : "default"}
        />
      ) : null}
      <OverviewStatCard
        pending={position.isPending}
        label="Cash"
        value={money ? formatWholeCurrency(money.unpaidCertified, currency) : "—"}
        helper={
          money
            ? `certified ${formatWholeCurrency(money.certifiedGrossToDate, currency)} · paid ${formatWholeCurrency(money.amountPaidToDate, currency)}`
            : "Contract position not available"
        }
        tone={money && money.unpaidCertified > 0 ? "danger" : "default"}
      />
      <OverviewStatCard
        dataTour="construction-approvals"
        pending={rfis.isPending}
        label="Open Items"
        value={openItems}
        helper={
          pendingChangeValue > 0
            ? `${openItemsHelper} · pending change value ${formatWholeCurrency(pendingChangeValue, currency)}`
            : openItemsHelper
        }
      />
    </section>
  );
}

OverviewKpis.displayName = "OverviewKpis";
