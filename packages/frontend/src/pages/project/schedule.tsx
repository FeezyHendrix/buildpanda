import { useMemo } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectActivities } from "@/hooks/use-activities";
import { useProjectDailyLogs } from "@/hooks/use-daily-logs";
import { useProjectFinances } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import type { Activity, ActivityDelay, ActivityStatus } from "@/lib/project-types";

const PROGRESS_BY_STATUS: Record<ActivityStatus, number> = {
  Planned: 0,
  InProgress: 50,
  Completed: 100,
  Cancelled: 0,
};

interface GanttTask {
  id: string;
  text: string;
  type: "summary" | "task";
  parent: string | number;
  open?: boolean;
  start?: Date;
  end?: Date;
  progress?: number;
}

interface DelaySummary {
  open: number;
  total: number;
  cost: number;
}

interface ScheduleReport {
  milestoneCount: number;
  milestoneCost: number;
  activityCount: number;
  completedActivities: number;
  delayedActivities: number;
  dailyLogCount: number;
  delayCount: number;
  openDelayCount: number;
  delayCost: number;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  projectedEnd: Date | null;
}

interface GanttScale {
  unit: "month" | "week";
  step: number;
  format: (date: Date) => string;
}

const SCALES: GanttScale[] = [
  {
    unit: "month",
    step: 1,
    format: (date) =>
      date.toLocaleString("en-US", { month: "long", year: "numeric" }),
  },
  {
    unit: "week",
    step: 1,
    format: (date) =>
      date.toLocaleString("en-US", { month: "short", day: "numeric" }),
  },
];

const ROOT_PARENT = 0;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function delayEnd(delay: ActivityDelay, activityEnd: Date): Date {
  const resolved = delay.resolvedAt ? parseDate(delay.resolvedAt) : null;
  if (resolved) return resolved;

  const started = parseDate(delay.startedAt) ?? activityEnd;
  const today = new Date();
  return new Date(Math.max(activityEnd.getTime(), started.getTime() + DAY_MS, today.getTime()));
}

function delaySummary(activities: Activity[]): DelaySummary {
  return activities.reduce<DelaySummary>(
    (summary, activity) => {
      for (const delay of activity.delays) {
        summary.total += 1;
        summary.cost += delay.costImpact;
        if (delay.resolvedAt === null) summary.open += 1;
      }
      return summary;
    },
    { open: 0, total: 0, cost: 0 },
  );
}

function buildReport(
  activities: Activity[],
  milestoneCost: number,
  milestoneCount: number,
  dailyLogCount: number,
): ScheduleReport {
  let plannedStart: Date | null = null;
  let plannedEnd: Date | null = null;
  let projectedEnd: Date | null = null;
  let delayCount = 0;
  let openDelayCount = 0;
  let delayCost = 0;

  for (const activity of activities) {
    const start = parseDate(activity.plannedStartAt);
    const end = parseDate(activity.plannedEndAt);
    if (start && (!plannedStart || start < plannedStart)) plannedStart = start;
    if (end && (!plannedEnd || end > plannedEnd)) plannedEnd = end;
    if (end && (!projectedEnd || end > projectedEnd)) projectedEnd = end;

    for (const delay of activity.delays) {
      delayCount += 1;
      delayCost += delay.costImpact;
      if (delay.resolvedAt === null) openDelayCount += 1;
      if (end) {
        const delayedEnd = delayEnd(delay, end);
        if (!projectedEnd || delayedEnd > projectedEnd) projectedEnd = delayedEnd;
      }
    }
  }

  return {
    milestoneCount,
    milestoneCost,
    activityCount: activities.length,
    completedActivities: activities.filter((activity) => activity.status === "Completed").length,
    delayedActivities: activities.filter((activity) => activity.isDelayed).length,
    dailyLogCount,
    delayCount,
    openDelayCount,
    delayCost,
    plannedStart,
    plannedEnd,
    projectedEnd,
  };
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectSchedule() {
  const { project } = useProjectContext();
  const { data: activities = [], isPending } = useProjectActivities(project.id);
  const { data: dailyLogs = [] } = useProjectDailyLogs(project.id);
  const { data: finances } = useProjectFinances(project.id);
  const milestones = finances?.milestones ?? [];

  const { tasks, rangeStart, rangeEnd, delays } = useMemo(() => {
    const phaseById = new Map(
      project.timeline.map((phase) => [phase.id, phase]),
    );

    // Only build summary rows for phases that actually contain activities,
    // so SVAR can derive a valid span for each summary from its children.
    const usedPhaseIds = new Set<string>();
    for (const activity of activities) {
      if (activity.phaseId && phaseById.has(activity.phaseId)) {
        usedPhaseIds.add(activity.phaseId);
      }
    }

    const summaryRows: GanttTask[] = [];
    for (const phaseId of usedPhaseIds) {
      const phase = phaseById.get(phaseId)!;
      summaryRows.push({
        id: phase.id,
        text: phase.name,
        type: "summary",
        parent: ROOT_PARENT,
        open: true,
      });
    }

    const taskRows: GanttTask[] = [];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (const activity of activities) {
      const start = parseDate(activity.plannedStartAt);
      const end = parseDate(activity.plannedEndAt);
      if (!start || !end) continue;

      const parent =
        activity.phaseId && usedPhaseIds.has(activity.phaseId)
          ? activity.phaseId
          : ROOT_PARENT;

      taskRows.push({
        id: activity.id,
        text: activity.isDelayed ? `${activity.name} · delayed` : activity.name,
        type: "task",
        parent,
        start,
        end,
        progress: PROGRESS_BY_STATUS[activity.status],
      });

      min = Math.min(min, start.getTime());
      max = Math.max(max, end.getTime());

      for (const delay of activity.delays) {
        const delayStart = parseDate(delay.startedAt);
        if (!delayStart) continue;
        const extendedEnd = delayEnd(delay, end);
        taskRows.push({
          id: `${activity.id}-${delay.id}`,
          text: `Delay: ${delay.reasonName}`,
          type: "task",
          parent,
          start: delayStart,
          end: extendedEnd,
          progress: delay.resolvedAt ? 100 : 10,
        });
        min = Math.min(min, delayStart.getTime());
        max = Math.max(max, extendedEnd.getTime());
      }
    }

    const hasRange = Number.isFinite(min) && Number.isFinite(max);

    return {
      tasks: [...summaryRows, ...taskRows],
      rangeStart: hasRange ? new Date(min - 7 * DAY_MS) : undefined,
      rangeEnd: hasRange ? new Date(max + 7 * DAY_MS) : undefined,
      delays: delaySummary(activities),
    };
  }, [activities, project.timeline]);

  const report = useMemo(
    () =>
      buildReport(
        activities,
        milestones.reduce((sum, milestone) => sum + milestone.amount, 0),
        milestones.length,
        dailyLogs.length,
      ),
    [activities, dailyLogs.length, milestones],
  );

  function downloadReport(): void {
    const payload = {
      project: { id: project.id, name: project.name },
      generatedAt: new Date().toISOString(),
      report: {
        ...report,
        plannedStart: report.plannedStart?.toISOString() ?? null,
        plannedEnd: report.plannedEnd?.toISOString() ?? null,
        projectedEnd: report.projectedEnd?.toISOString() ?? null,
      },
      milestones,
      activities,
      dailyLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-schedule-report.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const hasSchedule = tasks.some((task) => task.type === "task");

  return (
    <div className="flex h-full w-full flex-col bg-[#FCFCFD]">
      <div className="shrink-0 border-b border-[#EDEDED] bg-white px-6 py-4 sm:px-8">
        <PageHeader
          title="Project Chart"
          description="Gantt chart of milestone work items, planned dates, progress, and every logged delay's project timeline impact."
          actions={
            <Button variant="secondary" size="sm" onClick={downloadReport}>
              Export report
            </Button>
          }
          badges={
            delays.total > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={delays.open > 0 ? "danger" : "neutral"} size="md" dot>
                  {delays.open} open delay{delays.open === 1 ? "" : "s"}
                </Badge>
                <Badge tone="warning" size="md">
                  {formatCurrency(delays.cost, project.currency, { compact: true })} delay cost
                </Badge>
              </div>
            ) : null
          }
        />
      </div>

      {isPending ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <Card padding="lg" className="text-center text-sm text-gray-500">
            Loading schedule…
          </Card>
        </div>
      ) : !hasSchedule ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <Card padding="lg">
            <EmptyState
              icon={<CalendarIcon className="size-8 text-gray-300" />}
              title="No scheduled activities"
              description="Create milestone work items from Site Activity to populate the project Gantt chart."
            />
          </Card>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <ScheduleReportPanel report={report} currency={project.currency} />
          <div className="min-h-0 w-full flex-1 overflow-hidden [&>.wx-willow-theme]:h-full">
            <Willow>
              <Gantt
                tasks={tasks}
                scales={SCALES}
                start={rangeStart}
                end={rangeEnd}
                cellWidth={100}
                cellHeight={38}
                readonly
              />
            </Willow>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleReportPanel({
  report,
  currency,
}: {
  report: ScheduleReport;
  currency: string;
}) {
  const movedDays =
    report.plannedEnd && report.projectedEnd
      ? Math.max(
          0,
          Math.ceil((report.projectedEnd.getTime() - report.plannedEnd.getTime()) / DAY_MS),
        )
      : 0;

  return (
    <section className="grid shrink-0 grid-cols-2 gap-3 border-b border-[#EDEDED] bg-[#FAFAFA] p-4 lg:grid-cols-6">
      <ReportMetric label="Milestone cost" value={formatCurrency(report.milestoneCost, currency, { compact: true })} />
      <ReportMetric label="Work items" value={`${report.completedActivities}/${report.activityCount}`} helper="completed" />
      <ReportMetric label="Daily logs" value={String(report.dailyLogCount)} />
      <ReportMetric label="Delay cost" value={formatCurrency(report.delayCost, currency, { compact: true })} tone={report.delayCost > 0 ? "danger" : undefined} />
      <ReportMetric label="Timeline shift" value={`${movedDays} d`} tone={movedDays > 0 ? "danger" : undefined} />
      <ReportMetric label="Projected end" value={formatDate(report.projectedEnd)} />
    </section>
  );
}

function ReportMetric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl border border-[#EDEDED] bg-white p-3">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className={tone === "danger" ? "mt-1 text-lg font-semibold tabular-nums text-[#C72525]" : "mt-1 text-lg font-semibold tabular-nums text-gray-900"}>
        {value}
      </p>
      {helper && <p className="mt-0.5 text-[11px] text-gray-400">{helper}</p>}
    </div>
  );
}
