import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { MediaGallery } from "@/components/molecules/media-gallery";
import { InspectionOutcomeDialog } from "@/components/molecules/inspection-outcome-dialog";
import {
  UpsertInspectionDialog,
  type UpsertInspectionValues,
} from "@/components/molecules/upsert-inspection-dialog";
import { useDeleteInspection, useEditInspection } from "@/hooks/use-inspections";
import { errorMessage } from "@/lib/api-error";
import { formatShortDate } from "@/lib/formatters";
import { INSPECTION_STATUS_TONE, RISK_LEVEL_TONE } from "@/lib/project-meta";
import type { InspectionCategory, InspectionReport } from "@/lib/project-types";
import { toast } from "@/lib/toast";

interface InspectionCardProps {
  projectId: string;
  report: InspectionReport;
  canManage: boolean;
  /** Name of the linked activity, when there is one. */
  activityName: string | null;
  /** True when the linked activity has not started — the trip may be wasted. */
  activityNotStarted: boolean;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-black-300">{label}</p>
      <div className="text-sm text-black-500">{children}</div>
    </div>
  );
}

function InspectionCard({
  projectId,
  report,
  canManage,
  activityName,
  activityNotStarted,
}: InspectionCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editInspection = useEditInspection();
  const deleteInspection = useDeleteInspection();

  function handleEdit(values: UpsertInspectionValues): void {
    editInspection.mutate(
      { projectId, inspectionId: report.id, ...values },
      {
        onSuccess: () => {
          setEditOpen(false);
          toast("Inspection updated", "success");
        },
      },
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{report.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone={INSPECTION_STATUS_TONE[report.status]} size="sm">
              {report.status}
            </Badge>
            {report.holdPoint ? (
              <Badge tone="warning" size="sm">
                ⛔ Hold point
              </Badge>
            ) : null}
            {report.outcome ? (
              <Badge tone={report.outcome === "pass" ? "success" : "danger"} size="sm">
                {report.outcome === "pass" ? "✓ Passed" : "✕ Failed"}
              </Badge>
            ) : null}
          </div>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOutcomeOpen(true)}>
              Record result
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {activityNotStarted ? (
        <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
          ⚠ {activityName} has not started. There may be nothing to inspect on this date.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-4 border-b border-line-hair pb-6 sm:gap-6">
        <Field label="Inspector">{report.inspector.name}</Field>
        <Field label="Date">{formatShortDate(report.scheduledAt) || report.scheduledAt}</Field>
        <Field label="Location">{report.location ?? "—"}</Field>
        <Field label="Activity">{activityName ?? "Not linked"}</Field>
        <Field label="Risk level">
          <Badge tone={RISK_LEVEL_TONE[report.riskLevel]} size="md" dot className="m-0 bg-transparent p-0">
            {report.riskLevel}
          </Badge>
        </Field>
        {report.reinspectionDate ? (
          <Field label="Re-inspection">{formatShortDate(report.reinspectionDate)}</Field>
        ) : null}
      </div>

      <p className="text-pretty text-sm text-gray-600">{report.description}</p>

      {report.findings ? (
        <div className="rounded-lg bg-surface-alt p-3">
          <p className="text-xs font-medium uppercase text-ink-muted">Findings</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{report.findings}</p>
          {report.inspectedByName ? (
            <p className="mt-2 text-xs text-gray-500">
              {report.inspectedByName}
              {report.inspectedAt ? ` · ${formatShortDate(report.inspectedAt)}` : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      <MediaGallery items={report.media} />

      <div className="flex items-center justify-between border-t border-line-hair pt-4">
        <span className="text-xs text-gray-500">Category · {report.category}</span>
        {report.reportUrl && report.reportUrl !== "#" ? (
          <a
            href={report.reportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-500 hover:underline"
          >
            View full report
            <ChevronRightIcon className="size-3.5" />
          </a>
        ) : null}
      </div>

      <UpsertInspectionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        projectId={projectId}
        initial={{
          title: report.title,
          category: report.category as Exclude<InspectionCategory, "All Reports">,
          description: report.description,
          scheduledAt: report.scheduledAt.slice(0, 10),
          status: report.status,
          riskLevel: report.riskLevel,
          activityId: report.activityId,
          location: report.location,
          holdPoint: report.holdPoint,
        }}
        onSubmit={handleEdit}
        isSubmitting={editInspection.isPending}
        error={editInspection.error ? errorMessage(editInspection.error) : null}
      />

      <InspectionOutcomeDialog
        open={outcomeOpen}
        onOpenChange={setOutcomeOpen}
        projectId={projectId}
        inspection={report}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        loading={deleteInspection.isPending}
        onConfirm={() =>
          deleteInspection.mutate(
            { projectId, inspectionId: report.id },
            { onSuccess: () => setDeleteOpen(false) },
          )
        }
        title="Delete inspection"
        description="This permanently removes the inspection request and its findings. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </Card>
  );
}

InspectionCard.displayName = "InspectionCard";

export { InspectionCard, type InspectionCardProps };
