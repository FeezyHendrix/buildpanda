import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { PageHeader } from "@/components/molecules/page-header";
import { FilterTabs, VIEW_MODE_ITEMS } from "@/components/molecules/filter-tabs";
import { RequestInspectionDialog } from "@/components/molecules/request-inspection-dialog";
import { KanbanBoard } from "@/components/molecules/kanban-board";
import {
  INSPECTION_COLUMNS,
  textMeta,
} from "@/components/molecules/kanban-configs";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectInspections,
  useRequestInspection,
  useEditInspection,
} from "@/hooks/use-inspections";
import { useProjectActivities } from "@/hooks/use-activities";
import { errorMessage } from "@/lib/api-error";
import {
  canResourceAction,
  type InspectionCategory,
  type InspectionReport,
  type InspectionStatus,
} from "@/lib/project-types";
import { InspectionCard } from "./inspections/inspection-card";
import { icons } from "@/assets/icons/icons";
import { ReactSVG } from "react-svg";

const CATEGORIES: InspectionCategory[] = [
  "All Reports",
  "Structural",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
];
const FILTERS = CATEGORIES.map((value) => ({ value, label: value }));

export default function ProjectInspections() {
  const { project, access } = useProjectContext();
  const canRequestInspection = Boolean(
    access && canResourceAction(access, "inspections", "request"),
  );
  const canManageInspections = Boolean(
    access && canResourceAction(access, "inspections", "manage"),
  );
  const { data: inspections = [] } = useProjectInspections(project.id);
  const [activeFilter, setActiveFilter] =
    useState<InspectionCategory>("All Reports");
  const [requestOpen, setRequestOpen] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  const requestInspection = useRequestInspection();
  const editInspection = useEditInspection();
  const { data: activities = [] } = useProjectActivities(project.id);
  const activityById = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);

  // Nothing stops you inspecting work that has not happened; say so on the card
  // rather than letting an inspector travel for nothing (finding F44).
  function notStarted(report: InspectionReport): boolean {
    if (!report.activityId) return false;
    const activity = activityById.get(report.activityId);
    return Boolean(activity && activity.status === "Planned" && !activity.actualStartAt);
  }

  const visible = useMemo(
    () =>
      activeFilter === "All Reports"
        ? inspections
        : inspections.filter((i) => i.category === activeFilter),
    [inspections, activeFilter],
  );

  function handleMove(
    report: InspectionReport,
    status: InspectionStatus,
  ): void {
    if (report.status === status) return;
    editInspection.mutate({
      projectId: project.id,
      inspectionId: report.id,
      status,
    });
  }

  return (
    <div className="w-full px-4 lg:px-6 pt-4 pb-8 sm:px-10">
      <PageHeader
        title="Inspections & hold points"
        actions={
          canRequestInspection ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setRequestOpen(true)}
              className="h-[32px] cursor-pointer hover:bg-primary text-sm font-semibold px-[20px] py-[12px]"
            >
              <ReactSVG src={icons.plusCircle} />
              Request New Inspection
            </Button>
          ) : undefined
        }
      />

      <RequestInspectionDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        projectId={project.id}
        isSubmitting={requestInspection.isPending}
        error={requestInspection.error ? errorMessage(requestInspection.error) : null}
        onSubmit={(input) => {
          requestInspection.mutate(
            { projectId: project.id, ...input },
            { onSuccess: () => setRequestOpen(false) },
          );
        }}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          items={FILTERS}
          value={activeFilter}
          onChange={setActiveFilter}
          ariaLabel="Inspection categories"
        />
        <FilterTabs items={VIEW_MODE_ITEMS} value={view} onChange={setView} ariaLabel="View" />
      </div>

      {view === "board" ? (
        <div className="mt-6">
          <KanbanBoard
            items={visible}
            columns={INSPECTION_COLUMNS}
            canManage={canManageInspections}
            getId={(r) => r.id}
            getStatus={(r) => r.status}
            getTitle={(r) => r.title}
            renderMeta={(r) => textMeta(r.category)}
            renderFooter={(r) => (
              <span className="truncate text-xs text-gray-500">
                {r.inspector.name}
              </span>
            )}
            onMove={handleMove}
            onOpen={() => undefined}
          />
        </div>
      ) : (
        <section className="mt-6 flex flex-col gap-4">
          {visible.length === 0 ? (
            <Card padding="lg" className="text-center text-sm text-gray-500">
              No inspections match this filter.
            </Card>
          ) : (
            visible.map((report) => (
              <InspectionCard
                key={report.id}
                projectId={project.id}
                report={report}
                canManage={canManageInspections}
                activityName={report.activityId ? (activityById.get(report.activityId)?.name ?? null) : null}
                activityNotStarted={notStarted(report)}
              />
            ))
          )}
        </section>
      )}
    </div>
  );
}
