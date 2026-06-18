import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { MediaGallery } from "@/components/molecules/media-gallery";
import { PageHeader } from "@/components/molecules/page-header";
import { RequestInspectionDialog } from "@/components/molecules/request-inspection-dialog";
import { UpsertInspectionDialog, type UpsertInspectionValues } from "@/components/molecules/upsert-inspection-dialog";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { KanbanBoard } from "@/components/molecules/kanban-board";
import { INSPECTION_COLUMNS, textMeta } from "@/components/molecules/kanban-configs";
import { useProjectContext } from "@/layouts/project-layout";
import {
  useProjectInspections,
  useRequestInspection,
  useEditInspection,
  useDeleteInspection,
} from "@/hooks/use-inspections";
import {
  INSPECTION_STATUS_TONE,
  RISK_LEVEL_TONE,
} from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import type {
  InspectionCategory,
  InspectionReport,
  InspectionStatus,
} from "@/lib/project-types";
import { icons } from "@/assets/icons/icons";
import { ReactSVG } from "react-svg";

const FILTERS: InspectionCategory[] = [
  "All Reports",
  "Structural",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
];

export default function ProjectInspections() {
  const { project, access } = useProjectContext();
  const canRequestInspection = (access?.capabilities?.canManage ?? false) || access?.relationship === "inspector";
  const { data: inspections = [] } = useProjectInspections(project.id);
  const [activeFilter, setActiveFilter] =
    useState<InspectionCategory>("All Reports");
  const [requestOpen, setRequestOpen] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  const requestInspection = useRequestInspection();
  const editInspection = useEditInspection();

  const visible = useMemo(
    () =>
      activeFilter === "All Reports"
        ? inspections
        : inspections.filter((i) => i.category === activeFilter),
    [inspections, activeFilter],
  );

  function handleMove(report: InspectionReport, status: InspectionStatus): void {
    if (report.status === status) return;
    editInspection.mutate({ projectId: project.id, inspectionId: report.id, status });
  }

  return (
    <div className="w-full px-6 py-8 sm:px-10">
      <PageHeader
        title="Independent Inspections & Quality Reports"
        description="Verified structural and progress assessments for peace of mind."
        actions={
          canRequestInspection ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => setRequestOpen(true)}
              className="h-[32px] cursor-pointer hover:bg-primary text-[13px] font-semibold px-[20px] py-[12px]"
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
        isSubmitting={requestInspection.isPending}
        error={
          requestInspection.error
            ? (requestInspection.error as Error).message
            : null
        }
        onSubmit={(input) => {
          requestInspection.mutate(
            { projectId: project.id, ...input },
            { onSuccess: () => setRequestOpen(false) },
          );
        }}
      />

      <div className="mt-8 flex items-center justify-between gap-3">
        <FilterTabs
          filters={FILTERS}
          active={activeFilter}
          onChange={setActiveFilter}
        />
        <div className="inline-flex shrink-0 rounded-lg border border-[#EDEDED] bg-[#F6F6F6] p-1">
          {(["list", "board"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "board" ? (
        <div className="mt-6">
          <KanbanBoard
            items={visible}
            columns={INSPECTION_COLUMNS}
            canManage={canRequestInspection}
            getId={(r) => r.id}
            getStatus={(r) => r.status}
            getTitle={(r) => r.title}
            renderMeta={(r) => textMeta(r.category)}
            renderFooter={(r) => (
              <span className="truncate text-xs text-gray-500">{r.inspector.name}</span>
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
              <InspectionCard key={report.id} projectId={project.id} report={report} />
            ))
          )}
        </section>
      )}
    </div>
  );
}

interface FilterTabsProps {
  filters: readonly InspectionCategory[];
  active: InspectionCategory;
  onChange: (filter: InspectionCategory) => void;
  className?: string;
}

function FilterTabs({ filters, active, onChange, className }: FilterTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Inspection categories"
      className={cn("flex bg-[#F6F6F6] rounded-[1000px] h-[32px] max-w-[657px]", className)}
    >
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          role="tab"
          aria-selected={filter === active}
          onClick={() => onChange(filter)}
          className={cn(
            "rounded-full px-4 text-xs font-medium transition-colors m-1 cursor-pointer",
            "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
            filter === active
              ? "bg-[#FFFFFF] text-black-500"
              : "bg-transparent text-black-300 hover:bg-[#EDEDED]",
          )}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}

function InspectionCard({
  projectId,
  report,
}: {
  projectId: string;
  report: InspectionReport;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editInspection = useEditInspection();
  const deleteInspection = useDeleteInspection();

  function handleEdit(values: UpsertInspectionValues): void {
    editInspection.mutate(
      { projectId, inspectionId: report.id, ...values },
      { onSuccess: () => setEditOpen(false) },
    );
  }

  function handleDelete(): void {
    deleteInspection.mutate({ projectId, inspectionId: report.id });
  }

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 ">
          <div>
            <p className="text-base font-semibold text-[#131B2E]">
              {report.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={INSPECTION_STATUS_TONE[report.status]} size="md">
            {report.status}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-[#F6F6F6] pb-6">
        <div className='flex flex-col gap-1'>
          <p className="text-[13px] font-medium text-black-300">Inspector</p>
          <p className='text-[13px] text-black-500'>{report.inspector.name}</p>
        </div>
        <div className='flex flex-col gap-1'>
          <p className="text-[13px] font-medium text-black-300">Date & Time</p>
          <p className='text-[13px] text-black-500'>{report.scheduledAt}</p>
        </div>
        <div className='flex flex-col gap-1'>
          <p className="text-[13px] font-medium text-black-300">Risk Level</p>
          <Badge tone={RISK_LEVEL_TONE[report.riskLevel]} size="md" dot className='bg-transparent p-0 m-0'>
            {report.riskLevel}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-gray-600 text-pretty">{report.description}</p>

      <MediaGallery items={report.media} />

      <div className="flex items-center justify-between border-t border-[#F0F0F0] pt-4">
        <span className="text-xs text-gray-500">
          Category · {report.category}
        </span>
        {report.reportUrl && report.reportUrl !== "#" ? (
          <a
            href={report.reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#004DE7] hover:underline"
          >
            View Full Report
            <ChevronRightIcon className="size-3.5" />
          </a>
        ) : null}
      </div>

      <UpsertInspectionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={{
          title: report.title,
          category: report.category as Exclude<InspectionCategory, "All Reports">,
          description: report.description,
          scheduledAt: report.scheduledAt,
          status: report.status,
          riskLevel: report.riskLevel,
        }}
        onSubmit={handleEdit}
        isSubmitting={editInspection.isPending}
        error={(editInspection.error as Error | undefined)?.message ?? null}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        title="Delete inspection"
        description="This permanently removes the inspection report. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </Card>
  );
}
