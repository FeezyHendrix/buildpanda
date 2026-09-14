import { Badge } from "@/components/atoms/badge";
import { ShieldIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import type { InspectionReport } from "@/lib/project-types";
import { OUTCOME_META, SERVICE_STATUS_META } from "./inspection-helpers";

const COLUMN_COUNT = 9;

interface InspectionsTableProps {
  inspections: InspectionReport[];
  totalCount: number;
  isPending: boolean;
  /** Activity id -> name, so a row can say what work the inspection holds. */
  activityNames: ReadonlyMap<string, string>;
  onOpen: (report: InspectionReport) => void;
  onClearFilters: () => void;
  onRequest?: () => void;
}

/**
 * The inspection register. A PM scans it for what is still unassigned, what
 * failed and what is holding work — so it is a table, one row per service
 * order, not a wall of cards.
 */
export function InspectionsTable({
  inspections,
  totalCount,
  isPending,
  activityNames,
  onOpen,
  onClearFilters,
  onRequest,
}: InspectionsTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[1180px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Inspection</TableHeaderCell>
            <TableHeaderCell>Contractor inspected</TableHeaderCell>
            <TableHeaderCell>Where / what it holds</TableHeaderCell>
            <TableHeaderCell>Hold point</TableHeaderCell>
            <TableHeaderCell>Service status</TableHeaderCell>
            <TableHeaderCell>Inspector</TableHeaderCell>
            <TableHeaderCell>Outcome</TableHeaderCell>
            <TableHeaderCell>Visit date</TableHeaderCell>
            <TableHeaderCell align="right">Fee recorded</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isPending ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <div className="flex justify-center py-10">
                <Spinner size="md" />
              </div>
            </TableEmptyRow>
          ) : inspections.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <EmptyState
                variant="inline"
                icon={<ShieldIcon />}
                title={totalCount === 0 ? "No inspections yet" : "No inspections match these filters"}
                description={
                  totalCount === 0
                    ? "Ask BuildPanda to inspect the contractor's work. An inspector is assigned, attends site and issues the report."
                    : "Try clearing the search or the service-status filter."
                }
                action={
                  totalCount === 0
                    ? onRequest
                      ? { label: "Request an inspection", onClick: onRequest }
                      : undefined
                    : { label: "Clear filters", onClick: onClearFilters }
                }
              />
            </TableEmptyRow>
          ) : (
            inspections.map((report) => (
              <InspectionRow
                key={report.id}
                report={report}
                activityName={
                  report.activityId ? (activityNames.get(report.activityId) ?? null) : null
                }
                onOpen={() => onOpen(report)}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

InspectionsTable.displayName = "InspectionsTable";

function InspectionRow({
  report,
  activityName,
  onOpen,
}: {
  report: InspectionReport;
  activityName: string | null;
  onOpen: () => void;
}) {
  const status = SERVICE_STATUS_META[report.serviceStatus];
  const outcome = report.outcome ? OUTCOME_META[report.outcome] : null;
  const unassigned = report.inspectorUserId === null;

  return (
    <TableRow
      onClick={onOpen}
      tone={report.serviceStatus === "Cancelled" ? "muted" : "default"}
      className="hover:bg-surface-alt"
    >
      <TableCell>
        <span className="font-medium text-ink">{report.title}</span>
        <p className="mt-0.5 text-xs text-ink-muted">{report.category}</p>
      </TableCell>
      <TableCell>{report.contractorName ?? "—"}</TableCell>
      <TableCell>
        {report.location ?? "—"}
        <p className="mt-0.5 text-xs text-ink-muted">
          {activityName ? `Holds: ${activityName}` : "Not linked to an activity"}
        </p>
      </TableCell>
      <TableCell>
        {report.holdPoint ? (
          <Badge tone="warning" size="sm" dot>
            ⛔ Hold point
          </Badge>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge tone={status.tone} size="sm" dot>
          {status.mark} {status.label}
        </Badge>
      </TableCell>
      <TableCell>
        {unassigned ? (
          <Badge tone="neutral" size="sm" dot>
            ○ Unassigned
          </Badge>
        ) : (
          <>
            {report.inspector.name}
            <p className="mt-0.5 text-xs text-ink-muted">{report.inspector.role}</p>
          </>
        )}
      </TableCell>
      <TableCell>
        {outcome ? (
          <Badge tone={outcome.tone} size="sm" dot>
            {outcome.mark} {outcome.label}
          </Badge>
        ) : (
          <span className="text-ink-muted">Not reported</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatShortDate(report.scheduledAt) || report.scheduledAt}
        {report.reinspectionDate ? (
          <p className="mt-0.5 text-xs text-ink-muted">
            Re-inspect {formatShortDate(report.reinspectionDate)}
          </p>
        ) : null}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {report.feeAmount != null
          ? formatCurrency(report.feeAmount, report.feeCurrency ?? "NGN")
          : "—"}
      </TableCell>
    </TableRow>
  );
}
