import { useMemo, useState } from "react";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { Breadcrumbs } from "@/components/molecules/breadcrumbs";
import { EmptyState } from "@/components/molecules/empty-state";
import { PageHeader } from "@/components/molecules/page-header";
import { ImportProgrammeDialog } from "@/components/molecules/import-programme-dialog";
import { useProjectContext } from "@/layouts/project-layout";
import { useProjectActivities } from "@/hooks/use-activities";
import { useBuildingScope } from "@/contexts/building-scope-context";
import { useScheduleEditor } from "./use-schedule-editor";
import { useProjectDailyLogs } from "@/hooks/use-daily-logs";
import { useProjectFinances } from "@/hooks/use-finances";
import { formatCurrency } from "@/lib/formatters";
import { canResourceAction } from "@/lib/project-types";
import { useFeatureFlag } from "@/hooks/use-feature-flags";

import {
  buildReport,
  buildGanttData,
  SCALES,
  GANTT_ZOOM,
} from "./schedule/schedule-utils";
import { ScheduleReportPanel } from "./schedule/schedule-report-panel";

export default function ProjectSchedule() {
  const { project, access } = useProjectContext();
  const { selectedBuildingId } = useBuildingScope();

  const { data: activities = [], isPending } = useProjectActivities(project.id, selectedBuildingId);
  const { data: dailyLogs = [] } = useProjectDailyLogs(project.id);
  const { data: finances } = useProjectFinances(project.id);
  const milestones = finances?.milestones ?? [];
  const [importOpen, setImportOpen] = useState(false);
  const canEdit = Boolean(access && canResourceAction(access, "schedule", "manage"));
  const isProgrammeImportEnabled = useFeatureFlag("ai.programmeImport");
  const { attach, undo, redo, canUndo, canRedo } = useScheduleEditor(project.id, activities);

  const { tasks, links, rangeStart, rangeEnd, delays } = useMemo(
    () => buildGanttData(activities, project.timeline),
    [activities, project.timeline],
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

  const hasSchedule = tasks.some((task) => task.type === "task");

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#FCFCFD] [&_.wx-willow-theme]:flex [&_.wx-willow-theme]:min-h-0 [&_.wx-willow-theme]:flex-1 [&_.wx-willow-theme]:flex-col">
      <div className="shrink-0 border-b border-[#EDEDED] bg-white px-6 py-4 sm:px-8">
        <Breadcrumbs
          items={[
            { label: "Schedule", to: `/project/${project.id}/schedule` },
            { label: "Project Chart" },
          ]}
          className="mb-4"
        />
        <PageHeader
          title="Project Chart"
          description="Gantt chart of milestone work items, planned dates, progress, and every logged delay's project timeline impact."
          actions={
            <div className="flex items-center gap-2">
              {canEdit && isProgrammeImportEnabled && (
                <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
                  Import programme
                </Button>
              )}
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
                canEdit && isProgrammeImportEnabled ? (
                  <Button variant="primary" size="sm" onClick={() => setImportOpen(true)}>
                    Import programme of works
                  </Button>
                ) : undefined
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

