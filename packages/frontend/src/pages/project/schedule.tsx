import { useMemo } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { Card } from "@/components/atoms/card";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectActivities } from "@/hooks/use-activities";
import type { ActivityStatus } from "@/lib/project-mock-data";

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

export default function ProjectSchedule() {
  const { project } = useProjectContext();
  const { data: activities = [], isPending } = useProjectActivities(project.id);

  const { tasks, rangeStart, rangeEnd } = useMemo(() => {
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
        text: activity.name,
        type: "task",
        parent,
        start,
        end,
        progress: PROGRESS_BY_STATUS[activity.status],
      });

      min = Math.min(min, start.getTime());
      max = Math.max(max, end.getTime());
    }

    const hasRange = Number.isFinite(min) && Number.isFinite(max);

    return {
      tasks: [...summaryRows, ...taskRows],
      rangeStart: hasRange ? new Date(min - 7 * DAY_MS) : undefined,
      rangeEnd: hasRange ? new Date(max + 7 * DAY_MS) : undefined,
    };
  }, [activities, project.timeline]);

  const hasSchedule = tasks.some((task) => task.type === "task");

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Schedule"
        description="Gantt timeline of site activities grouped by project phase, with planned dates and progress."
      />

      <section className="mt-8">
        {isPending ? (
          <Card padding="lg" className="text-center text-sm text-gray-500">
            Loading schedule…
          </Card>
        ) : !hasSchedule ? (
          <Card padding="lg">
            <EmptyState
              icon={<CalendarIcon className="size-8 text-gray-300" />}
              title="No scheduled activities"
              description="Activities with planned start and end dates appear here as a Gantt timeline."
            />
          </Card>
        ) : (
          <div className="h-[640px] w-full overflow-hidden rounded-2xl border border-[#EDEDED] bg-white">
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
        )}
      </section>
    </div>
  );
}
