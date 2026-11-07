import { Dialog } from "@base-ui/react/dialog";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { MediaGallery } from "@/components/molecules/media-gallery";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { InspectionReport } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import {
  OUTCOME_META,
  REQUESTER_SIDE_LABEL,
  SERVICE_STATUS_META,
} from "./inspection-helpers";

interface InspectionDetailDrawerProps {
  open: boolean;
  report: InspectionReport | null;
  activityName: string | null;
  /** True when the linked activity has not started — the trip may be wasted. */
  activityNotStarted: boolean;
  requestedByName: string | null;
  /** Whether the viewer is the BuildPanda inspector assigned to this job. */
  isInspector: boolean;
  canEdit: boolean;
  canCancel: boolean;
  attending: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onCancel: () => void;
  onMarkAttended: () => void;
  onRecordOutcome: () => void;
}

/**
 * One service order in full. Everything the contractor and the client may read
 * is here; the controls that write the report appear only for the assigned
 * inspector, because an inspection is independent of whoever is building.
 */
export function InspectionDetailDrawer({
  open,
  report,
  activityName,
  activityNotStarted,
  requestedByName,
  isInspector,
  canEdit,
  canCancel,
  attending,
  onOpenChange,
  onEdit,
  onCancel,
  onMarkAttended,
  onRecordOutcome,
}: InspectionDetailDrawerProps) {
  if (!report) return null;

  const status = SERVICE_STATUS_META[report.serviceStatus];
  const outcome = report.outcome ? OUTCOME_META[report.outcome] : null;
  const reported = report.serviceStatus === "Reported";
  const cancelled = report.serviceStatus === "Cancelled";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-[min(560px,100vw)] flex-col border-l border-line-hair bg-white shadow-drawer outline-none",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
          )}
        >
          <header className="border-b border-line-hair px-6 py-5">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              {report.title}
            </Dialog.Title>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={status.tone} size="md" dot>
                {status.mark} {status.label}
              </Badge>
              {report.holdPoint ? (
                <Badge tone="warning" size="md" dot>
                  ⛔ Hold point
                </Badge>
              ) : null}
              {outcome ? (
                <Badge tone={outcome.tone} size="md" dot>
                  {outcome.mark} {outcome.label}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-gray-500">{status.blurb}</p>
          </header>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            {activityNotStarted ? (
              <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
                ⚠ {activityName} has not started. There may be nothing to inspect on this date.
              </p>
            ) : null}

            <section className="grid grid-cols-2 gap-4">
              <Field label="Category">{report.category}</Field>
              <Field label="Contractor inspected">{report.contractorName ?? "—"}</Field>
              <Field label="Requested by">
                {requestedByName ?? "—"}
                <p className="mt-0.5 text-xs text-ink-muted">
                  {REQUESTER_SIDE_LABEL[report.requestedBySide]}
                </p>
              </Field>
              <Field label="Inspector">
                {report.inspectorUserId === null ? (
                  <Badge tone="neutral" size="sm" dot>
                    ○ Unassigned
                  </Badge>
                ) : (
                  <>
                    {report.inspector.name}
                    <p className="mt-0.5 text-xs text-ink-muted">{report.inspector.role}</p>
                  </>
                )}
              </Field>
              <Field label="Visit date">
                {formatShortDate(report.scheduledAt) || report.scheduledAt}
              </Field>
              <Field label="Location / chainage">{report.location ?? "—"}</Field>
              <Field label="Activity it holds">{activityName ?? "Not linked"}</Field>
              <Field label="Fee recorded">
                {report.feeAmount != null
                  ? formatCurrency(report.feeAmount, report.feeCurrency ?? "NGN")
                  : "—"}
                <p className="mt-0.5 text-xs text-ink-muted">Logged, never charged</p>
              </Field>
              {report.reportIssuedAt ? (
                <Field label="Report issued">{formatShortDate(report.reportIssuedAt)}</Field>
              ) : null}
              {report.reinspectionDate ? (
                <Field label="Re-inspection">{formatShortDate(report.reinspectionDate)}</Field>
              ) : null}
            </section>

            <section>
              <p className="text-xs font-medium uppercase text-ink-muted">What was asked for</p>
              <p className="mt-2 text-pretty text-sm leading-6 text-gray-700">
                {report.description}
              </p>
            </section>

            {report.findings ? (
              <section className="rounded-lg bg-surface-alt p-3">
                <p className="text-xs font-medium uppercase text-ink-muted">Findings</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{report.findings}</p>
                {report.inspectedByName ? (
                  <p className="mt-2 text-xs text-gray-500">
                    {report.inspectedByName}
                    {report.inspectedAt ? ` · ${formatShortDate(report.inspectedAt)}` : ""}
                  </p>
                ) : null}
              </section>
            ) : null}

            <MediaGallery items={report.media} />

            <InspectorControls
              report={report}
              isInspector={isInspector}
              attending={attending}
              onMarkAttended={onMarkAttended}
              onRecordOutcome={onRecordOutcome}
            />
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line-hair px-6 py-4">
            <Dialog.Close
              render={
                <Button type="button" variant="secondary" size="sm">
                  Close
                </Button>
              }
            />
            {canCancel ? (
              <Button type="button" variant="danger" size="sm" onClick={onCancel}>
                Cancel inspection
              </Button>
            ) : null}
            {canEdit && !reported && !cancelled ? (
              <Button type="button" size="sm" onClick={onEdit}>
                Edit request
              </Button>
            ) : null}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

InspectionDetailDrawer.displayName = "InspectionDetailDrawer";

/**
 * The independence rule made visible. For anyone who is not the assigned
 * inspector there are no outcome controls at all — not disabled ones that fail
 * on click — and a line saying who does record the result.
 */
function InspectorControls({
  report,
  isInspector,
  attending,
  onMarkAttended,
  onRecordOutcome,
}: {
  report: InspectionReport;
  isInspector: boolean;
  attending: boolean;
  onMarkAttended: () => void;
  onRecordOutcome: () => void;
}) {
  if (report.serviceStatus === "Cancelled") {
    return (
      <p className="rounded-lg bg-surface-alt px-3 py-2 text-xs text-gray-600">
        This inspection was cancelled. Nothing further is recorded against it.
      </p>
    );
  }

  if (!isInspector) {
    return (
      <p className="rounded-lg bg-surface-alt px-3 py-2 text-xs leading-5 text-gray-600">
        A BuildPanda inspector records the result. An inspection is independent of whoever is
        building: the contractor is its subject, never its author, so the outcome and findings
        can only be entered by the inspector assigned to this visit
        {report.inspectorUserId === null
          ? " — BuildPanda has not assigned one yet."
          : `, ${report.inspector.name}.`}
      </p>
    );
  }

  if (report.serviceStatus === "Reported") {
    return (
      <p className="rounded-lg bg-surface-alt px-3 py-2 text-xs text-gray-600">
        You issued this report. It is an independent record and stands as issued.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line-hair p-3">
      <p className="text-xs font-medium uppercase text-ink-muted">Your inspection</p>
      <div className="flex flex-wrap gap-2">
        {report.serviceStatus === "Attended" ? null : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={attending}
            onClick={onMarkAttended}
          >
            Mark attended
          </Button>
        )}
        <Button type="button" size="sm" onClick={onRecordOutcome}>
          Record outcome
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        Recording the outcome issues the report. A fail needs findings and a re-inspection date.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase text-ink-muted">{label}</p>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}
