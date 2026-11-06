import { useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { useSetPageTitle } from "@/contexts/page-title-context";
import { ImportProgrammeDialog } from "@/components/molecules/import-programme-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectActivities } from "@/hooks/use-activities";
import { useKeyDates } from "@/hooks/use-key-dates";
import { useStages } from "@/hooks/use-stages";
import { useBuildingScope } from "@/contexts/building-scope-context";
import { useScheduleEditor } from "./use-schedule-editor";
import { useProjectDailyLogs } from "@/hooks/use-daily-logs";
import { useProjectFinances } from "@/hooks/use-finances";
import { useReportingSnapshot } from "@/hooks/use-reporting-snapshot";
import { formatCurrency } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import { useFeatureFlag } from "@/hooks/use-feature-flags";

import { buildReport } from "./schedule/schedule-utils";
import { ScheduleChart } from "./schedule/schedule-chart";
import { buildGanttData } from "./schedule/schedule-gantt-data";
import { ScheduleReportPanel } from "./schedule/schedule-report-panel";

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function ProjectSchedule() {
  useSetPageTitle("Programme of work", "The project's activities on a timeline: drag to reschedule, and see delays against the baseline.");
  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();
  const canViewStages = Boolean(access && canResourceAction(access, "stages", "view"));
  const canViewKeyDates = Boolean(access && canResourceAction(access, "key-dates", "view"));

  const { data: activities = [], isPending } = useProjectActivities(project.id, selectedBuildingId);
  const { data: stages = [], isPending: isStagesPending } = useStages(canViewStages ? project.id : undefined, selectedBuildingId);
  const { data: keyDates = [], isPending: isKeyDatesPending } = useKeyDates(canViewKeyDates ? project.id : undefined, selectedBuildingId);
  const { data: dailyLogs = [] } = useProjectDailyLogs(project.id);
  const { data: finances } = useProjectFinances(project.id);
  // The completion position is the project's, not the chart's — same source as the overview.
  const { data: snapshot } = useReportingSnapshot(project.id);
  const milestones = finances?.milestones ?? [];
  const [importOpen, setImportOpen] = useState(false);
  const canEdit = Boolean(access && canResourceAction(access, "schedule", "manage"));
  const isProgrammeImportEnabled = useFeatureFlag("ai.programmeImport");
  const { attach, undo, redo, canUndo, canRedo } = useScheduleEditor(project.id, activities);

  const { tasks, links, rangeStart, rangeEnd, delays, criticalCount } = useMemo(
    () => buildGanttData(activities, project.timeline, stages, keyDates),
    [activities, project.timeline, stages, keyDates],
  );
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

  const loggedToday = useMemo(
    () => dailyLogs.filter((log) => !log.voidedAt && log.logDate.slice(0, 10) === todayKey()).length,
    [dailyLogs],
  );

  const isSchedulePending = isPending || (canViewStages && isStagesPending) || (canViewKeyDates && isKeyDatesPending);
  const hasSchedule = tasks.length > 0;

  return (
    <div className="h-full w-full overflow-y-auto px-4 pb-8 pt-[24px] lg:pl-8 lg:pr-[40px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {criticalCount > 0 && (
            <Badge tone="danger" size="md">
              Critical chain: {criticalCount} item{criticalCount === 1 ? "" : "s"}
            </Badge>
          )}
          {delays.total > 0 && (
            <>
              <Badge tone={delays.open > 0 ? "danger" : "neutral"} size="md" dot>
                {delays.open} open delay{delays.open === 1 ? "" : "s"}
              </Badge>
              <Badge tone="warning" size="md">
                {formatCurrency(delays.cost, project.currency, { compact: true })} delay cost
              </Badge>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-[9px]">
          {canEdit && isProgrammeImportEnabled && (
            <Button
              variant="secondary"
              onClick={() => setImportOpen(true)}
              className="h-[36px] gap-[8px] border border-[#DDDDDD] bg-white px-[16px] text-[14px] font-medium text-[#1E1E1E] hover:bg-[#F5F5F5]"
            >
              <Upload className="size-[18px]" strokeWidth={1.5} />
              Import programme
            </Button>
          )}
          <Button variant="primary" onClick={downloadReport} className="h-[36px] gap-[8px] px-[16px] text-[14px] font-medium">
            <Download className="size-[18px]" strokeWidth={1.5} />
            Export Programme
          </Button>
        </div>
      </div>

      {isSchedulePending ? (
        <div className="flex items-center justify-center p-16">
          <Spinner size="md" />
        </div>
      ) : !hasSchedule ? (
        <div className="flex items-center justify-center p-6">
          <EmptyState
            icon={<CalendarIcon />}
            title="No scheduled activities yet"
            description="Create milestone work items from Site activity, or import a Microsoft Project (.mpp/.xml) or Excel programme of works to populate the chart."
            action={
              canEdit && isProgrammeImportEnabled
                ? { label: "Import programme of works", onClick: () => setImportOpen(true) }
                : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-[24px]">
            <ScheduleReportPanel
              report={report}
              loggedToday={loggedToday}
              timelineShiftDays={snapshot?.schedule.timelineShiftDays ?? null}
              projectedEndDate={snapshot?.schedule.revisedCompletionDate ?? snapshot?.schedule.completionDate ?? null}
            />
          </div>
          <div className="mt-[36px]">
            <ScheduleChart
              tasks={tasks}
              links={links}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              markers={markers}
              canEdit={canEdit}
              attach={attach}
              history={{ undo, redo, canUndo, canRedo }}
            />
          </div>
        </>
      )}
      <ImportProgrammeDialog open={importOpen} onOpenChange={setImportOpen} projectId={project.id} />
    </div>
  );
}
