import { useMemo, useState } from "react";
import { Avatar } from "@/components/atoms/avatar";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import {
  ChevronRightIcon,
  PlusIcon,
} from "@/components/atoms/project-nav-icons";
import { MediaGallery } from "@/components/molecules/media-gallery";
import { PageHeader } from "@/components/molecules/page-header";
import { RequestInspectionDialog } from "@/components/molecules/request-inspection-dialog";
import { UpsertInspectionDialog, type UpsertInspectionValues } from "@/components/molecules/upsert-inspection-dialog";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
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
} from "@/lib/project-mock-data";

const FILTERS: InspectionCategory[] = [
  "All Reports",
  "Structural",
  "Quantity Survey",
  "General Progress",
  "Electrical",
  "Plumbing",
];

export default function ProjectInspections() {
  const { project } = useProjectContext();
  const { data: inspections = [] } = useProjectInspections(project.id);
  const [activeFilter, setActiveFilter] =
    useState<InspectionCategory>("All Reports");
  const [requestOpen, setRequestOpen] = useState(false);
  const requestInspection = useRequestInspection();

  const visible = useMemo(
    () =>
      activeFilter === "All Reports"
        ? inspections
        : inspections.filter((i) => i.category === activeFilter),
    [inspections, activeFilter],
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <PageHeader
        title="Independent Inspections & Quality Reports"
        description="Verified structural and progress assessments for peace of mind."
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setRequestOpen(true)}
          >
            <PlusIcon className="size-4" />
            Request New Inspection
          </Button>
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

      <FilterTabs
        filters={FILTERS}
        active={activeFilter}
        onChange={setActiveFilter}
        className="mt-8"
      />

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
      className={cn("flex flex-wrap gap-2", className)}
    >
      {filters.map((filter) => (
        <button
          key={filter}
          type="button"
          role="tab"
          aria-selected={filter === active}
          onClick={() => onChange(filter)}
          className={cn(
            "h-9 rounded-full px-4 text-xs font-medium transition-colors",
            "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
            filter === active
              ? "bg-[#004DE7] text-white"
              : "bg-[#F6F6F6] text-gray-700 hover:bg-[#EDEDED]",
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
        <div className="flex items-start gap-3">
          <Avatar
            name={report.inspector.name}
            src={report.inspector.avatarUrl}
            size="md"
          />
          <div>
            <p className="text-base font-semibold text-gray-900">
              {report.title}
            </p>
            <p className="text-xs text-gray-500">
              {report.inspector.name} · {report.inspector.role}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">{report.scheduledAt}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={INSPECTION_STATUS_TONE[report.status]} size="md">
            {report.status}
          </Badge>
          <Badge tone={RISK_LEVEL_TONE[report.riskLevel]} size="md" dot>
            {report.riskLevel}
          </Badge>
          <div className="ml-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="text-xs font-medium text-gray-500 hover:text-gray-900"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="text-xs font-medium text-red-500 hover:text-red-600"
            >
              Delete
            </button>
          </div>
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
