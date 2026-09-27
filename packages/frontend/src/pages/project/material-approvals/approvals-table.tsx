import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { MaterialsIcon } from "@/components/atoms/project-nav-icons";
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
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import type { MaterialDecision } from "@/components/molecules/material-approval-decision-dialog";
import type { MaterialApproval } from "@/api/material-approvals";
import { formatShortDate } from "@/lib/formatters";
import {
  MATERIAL_APPROVAL_STATUS_META,
  formatQuantity,
  isAwaitingDecision,
  isDecided,
} from "./approval-helpers";

/**
 * The material approval register: one row per request, in the one status ladder
 * the backend enforces. A row opens the request; the decision itself still goes
 * through the decision dialog so a response can be recorded with it.
 */

const COLUMN_COUNT = 7;

const DECISION_ACTIONS: readonly { decision: MaterialDecision; label: string }[] = [
  { decision: "Approved", label: "Approve" },
  { decision: "Resubmit", label: "Request changes" },
  { decision: "Rejected", label: "Reject" },
] as const;

export interface ApprovalRowHandlers {
  onOpen: (approval: MaterialApproval) => void;
  onEdit: (approval: MaterialApproval) => void;
  onDelete: (approval: MaterialApproval) => void;
  onResubmit: (approval: MaterialApproval) => void;
  onDecide: (approval: MaterialApproval, decision: MaterialDecision) => void;
}

interface ApprovalsTableProps extends ApprovalRowHandlers {
  approvals: MaterialApproval[];
  isPending: boolean;
  isFiltered: boolean;
  canManage: boolean;
  /** Mirrors the backend guard: only the named reviewer may sign this one off. */
  mayDecide: (approval: MaterialApproval) => boolean;
  requesterName: (approval: MaterialApproval) => string | null;
  onCreate: () => void;
  onClearFilters: () => void;
}

export function ApprovalsTable({
  approvals,
  isPending,
  isFiltered,
  canManage,
  mayDecide,
  requesterName,
  onCreate,
  onClearFilters,
  onOpen,
  onEdit,
  onDelete,
  onResubmit,
  onDecide,
}: ApprovalsTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[1000px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Material</TableHeaderCell>
            <TableHeaderCell align="right">Quantity</TableHeaderCell>
            <TableHeaderCell>Supplier</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Needed by</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Decided</TableHeaderCell>
            <TableHeaderCell align="right" className="w-[72px]">
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isPending ? (
            <TableEmptyRow colSpan={COLUMN_COUNT} className="py-12">
              <div className="flex items-center justify-center">
                <Spinner size="md" />
              </div>
            </TableEmptyRow>
          ) : approvals.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              {isFiltered ? (
                <EmptyState
                  variant="inline"
                  title="No requests match these filters"
                  description="Try another status or search term."
                  action={{ label: "Clear filters", onClick: onClearFilters }}
                />
              ) : (
                <EmptyState
                  variant="inline"
                  icon={<MaterialsIcon />}
                  title="No material approval requests"
                  description="Raise a request to get a material and its specification signed off."
                  action={canManage ? { label: "Request approval", onClick: onCreate } : undefined}
                />
              )}
            </TableEmptyRow>
          ) : (
            approvals.map((approval) => (
              <ApprovalTableRow
                key={approval.id}
                approval={approval}
                canManage={canManage}
                canDecide={mayDecide(approval)}
                requester={requesterName(approval)}
                onOpen={onOpen}
                onEdit={onEdit}
                onDelete={onDelete}
                onResubmit={onResubmit}
                onDecide={onDecide}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

ApprovalsTable.displayName = "ApprovalsTable";

interface RowProps extends ApprovalRowHandlers {
  approval: MaterialApproval;
  canManage: boolean;
  canDecide: boolean;
  requester: string | null;
}

function ApprovalTableRow({
  approval,
  canManage,
  canDecide,
  requester,
  onOpen,
  onEdit,
  onDelete,
  onResubmit,
  onDecide,
}: RowProps) {
  const meta = MATERIAL_APPROVAL_STATUS_META[approval.status];
  const awaiting = isAwaitingDecision(approval);
  const decided = isDecided(approval);
  const decidedOn = formatShortDate(approval.reviewedAt);

  const actions = useMemo<RowActionItem[]>(
    () => [
      { label: "View", onSelect: () => onOpen(approval) },
      ...(canDecide && awaiting
        ? DECISION_ACTIONS.map(({ decision, label }) => ({
            label,
            onSelect: () => onDecide(approval, decision),
          }))
        : []),
      // A decided record is read-only; the replacement is a new request.
      ...(canManage && decided
        ? [{ label: "Resubmit as new request", onSelect: () => onResubmit(approval) }]
        : []),
      ...(canManage && !decided ? [{ label: "Edit", onSelect: () => onEdit(approval) }] : []),
      ...(canManage && !decided
        ? [{ label: "Delete", tone: "danger" as const, onSelect: () => onDelete(approval) }]
        : []),
    ],
    [approval, canManage, canDecide, awaiting, decided, onOpen, onEdit, onDelete, onResubmit, onDecide],
  );

  return (
    <TableRow onClick={() => onOpen(approval)}>
      <TableCell>
        <p className="line-clamp-1">
          <span className="font-medium text-ink">{approval.materialName}</span>
          {approval.specification ? (
            <span className="text-[13px] text-gray-600"> · {approval.specification}</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {requester ? `Requested by ${requester}` : approval.title}
        </p>
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {formatQuantity(approval.quantity, approval.unit)}
      </TableCell>
      <TableCell>{approval.supplier ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap">{formatShortDate(approval.neededBy) || "—"}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={meta.tone} size="sm">
            <span aria-hidden="true">{meta.glyph}</span>
            {meta.label}
          </Badge>
          {approval.resubmittedFromId ? (
            <Badge tone="info" size="sm" variant="outline">
              Resubmission
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        {approval.reviewedByName || decidedOn ? (
          <>
            <p className="whitespace-nowrap">{approval.reviewedByName ?? "—"}</p>
            {decidedOn ? <p className="mt-0.5 text-xs text-ink-muted">{decidedOn}</p> : null}
          </>
        ) : (
          <span className="text-ink-muted">
            {approval.requestedReviewerName
              ? `Awaiting ${approval.requestedReviewerName}`
              : "Awaiting decision"}
          </span>
        )}
      </TableCell>
      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <RowActionsMenu ariaLabel={`Actions for ${approval.materialName}`} items={actions} />
        </div>
      </TableCell>
    </TableRow>
  );
}

ApprovalTableRow.displayName = "ApprovalTableRow";
