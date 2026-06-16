import { useMemo, useState } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import type { ILink } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { ImportProgrammeDialog } from "@/components/molecules/import-programme-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectActivities } from "@/hooks/use-activities";
import { useScheduleEditor } from "./use-schedule-editor";
import { useProjectDailyLogs } from "@/hooks/use-daily-logs";
import { useProjectFinances } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import type { Activity, ActivityDelay } from "@/lib/project-types";

interface GanttTask {
  id: string | number;
  text: string;
  type: "summary" | "task" | "milestone";
  parent: string | number;
  open?: boolean;
  start?: Date;
  end?: Date;
  progress?: number;
  base_start?: Date;
  base_end?: Date;
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

const GANTT_ZOOM = { minCellWidth: 30, maxCellWidth: 240 } as const;

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
  if (!date) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProjectSchedule() {
  const { project, access } = useProjectContext();
  const { data: activities = [], isPending } = useProjectActivities(project.id);
  const { data: dailyLogs = [] } = useProjectDailyLogs(project.id);
  const { data: finances } = useProjectFinances(project.id);
  const milestones = finances?.milestones ?? [];
  const [importOpen, setImportOpen] = useState(false);
  const canEdit = access?.capabilities?.canManage ?? false;
  const { attach, undo, redo, canUndo, canRedo } = useScheduleEditor(project.id, activities);

  const { tasks, links, rangeStart, rangeEnd, delays } = useMemo(() => {
    const phaseById = new Map(
      project.timeline.map((phase) => [phase.id, phase]),
    );

    const usedPhaseIds = new Set<string>();
    const validTaskIds = new Set<string>();

    for (const activity of activities) {
      validTaskIds.add(activity.id);
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
      if (!start) continue;
      if (!activity.isMilestone && !end) continue;

      const parent =
        activity.phaseId && usedPhaseIds.has(activity.phaseId)
          ? activity.phaseId
          : ROOT_PARENT;

      const base_start = activity.baselineStartAt ? parseDate(activity.baselineStartAt) ?? undefined : undefined;
      const base_end = activity.baselineEndAt ? parseDate(activity.baselineEndAt) ?? undefined : undefined;

      taskRows.push({
        id: activity.id,
        text: activity.isDelayed ? `${activity.name} · delayed` : activity.name,
        type: activity.isMilestone ? "milestone" : "task",
        parent,
        start,
        end: activity.isMilestone ? start : end!,
        progress: Math.round(activity.percentComplete),
        base_start,
        base_end,
      });

      min = Math.min(min, start.getTime());
      if (end) max = Math.max(max, end.getTime());

      for (const delay of activity.delays) {
        const delayStart = parseDate(delay.startedAt);
        if (!delayStart) continue;
        const extendedEnd = delayEnd(delay, end ?? start);
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

    const links: ILink[] = [];
    let linkIdCounter = 1;
    const linkTypeMap: Record<string, "e2s" | "s2s" | "e2e" | "s2e"> = {
      FS: "e2s",
      SS: "s2s",
      FF: "e2e",
      SF: "s2e",
    };

    for (const activity of activities) {
      for (const pred of activity.predecessors) {
        if (validTaskIds.has(pred.activityId)) {
          links.push({
            id: String(linkIdCounter++),
            source: pred.activityId,
            target: activity.id,
            type: linkTypeMap[pred.type] ?? "e2s",
            lag: pred.lagDays,
          });
        }
      }
    }

    const hasRange = Number.isFinite(min) && Number.isFinite(max);

    return {
      tasks: [...summaryRows, ...taskRows],
      links,
      rangeStart: hasRange ? new Date(min - 7 * DAY_MS) : undefined,
      rangeEnd: hasRange ? new Date(max + 7 * DAY_MS) : undefined,
      delays: delaySummary(activities),
    };
  }, [activities, project.timeline]);

  const markers = useMemo(() => [{ start: new Date(), text: "Today" }], []);

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
    <div className="flex h-full min-h-0 w-full flex-col bg-[#FCFCFD] [&_.wx-willow-theme]:flex [&_.wx-willow-theme]:min-h-0 [&_.wx-willow-theme]:flex-1 [&_.wx-willow-theme]:flex-col">
      <div className="shrink-0 border-b border-[#EDEDED] bg-white px-6 py-4 sm:px-8">
        <PageHeader
          title="Project Chart"
          description="Gantt chart of milestone work items, planned dates, progress, and every logged delay's project timeline impact."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
                Import programme
              </Button>
              <Button variant="secondary" size="sm" onClick={downloadReport}>
                Export report
              </Button>
            </div>
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
              description="Create milestone work items from Site Activity, or import a Microsoft Project (.mpp/.xml) or Excel programme of works to populate the chart."
              action={
                <Button variant="primary" size="sm" onClick={() => setImportOpen(true)}>
                  Import programme of works
                </Button>
              }
            />
          </Card>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col bg-white">
          <ScheduleReportPanel report={report} currency={project.currency} />
          <div className="bp-gantt flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {canEdit && (
              <div className="flex items-center gap-2 border-b border-[#F0F0F0] px-4 py-2">
                <span className="text-xs text-gray-500">
                  Drag bars to reschedule. Changes save automatically.
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="secondary" size="sm" onClick={undo} disabled={!canUndo}>
                    Undo
                  </Button>
                  <Button variant="secondary" size="sm" onClick={redo} disabled={!canRedo}>
                    Redo
                  </Button>
                </div>
              </div>
            )}
            <Willow>
              <Gantt
                tasks={tasks}
                links={links}
                scales={SCALES}
                start={rangeStart}
                end={rangeEnd}
                cellWidth={100}
                cellHeight={38}
                baselines={true}
                zoom={GANTT_ZOOM}
                markers={markers}
                readonly={!canEdit}
                init={canEdit ? attach : undefined}
              />
            </Willow>
          </div>
        </div>
      )}
      <ImportProgrammeDialog open={importOpen} onOpenChange={setImportOpen} projectId={project.id} />
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
