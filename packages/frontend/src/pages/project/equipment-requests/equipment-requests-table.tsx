import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
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
import { formatCurrency } from "@/lib/formatters";
import type { EquipmentRequest, EquipmentRequestStatus } from "@/lib/project-types";
import {
  canAdvanceTo,
  canCancelEquipment,
  canDeleteEquipment,
  canExtendHire,
  canReturnHire,
  EQUIPMENT_STATUS_META,
  equipmentSubLine,
  formatEquipmentSpan,
  nextEquipmentStatus,
} from "./equipment-helpers";

const COLUMN_COUNT = 7;

export interface EquipmentRowHandlers {
  onEdit: (request: EquipmentRequest) => void;
  onDelete: (request: EquipmentRequest) => void;
  onCancel: (request: EquipmentRequest) => void;
  onExtend: (request: EquipmentRequest) => void;
  onReturn: (request: EquipmentRequest) => void;
  onAdvance: (request: EquipmentRequest, status: EquipmentRequestStatus) => void;
}

interface EquipmentRequestsTableProps extends EquipmentRowHandlers {
  requests: EquipmentRequest[];
  isPending: boolean;
  /** True when a search or filter is hiding rows, rather than there being none. */
  isFiltered: boolean;
  canRequest: boolean;
  canApprove: boolean;
  onAdd: () => void;
  onClearFilters: () => void;
}

/**
 * The plant hire register: one row per request, with the dates that drive
 * mobilisation and off-hire, and the recorded hire figures. Nothing here
 * charges anything — the rate and cost are logged numbers.
 */
export function EquipmentRequestsTable({
  requests,
  isPending,
  isFiltered,
  canRequest,
  canApprove,
  onAdd,
  onClearFilters,
  ...handlers
}: EquipmentRequestsTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[1100px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Equipment</TableHeaderCell>
            <TableHeaderCell>Needed</TableHeaderCell>
            <TableHeaderCell>On hire</TableHeaderCell>
            <TableHeaderCell align="right">Daily rate</TableHeaderCell>
            <TableHeaderCell align="right">Est. cost</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right" className="w-[180px]">
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
          ) : requests.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              {isFiltered ? (
                <EmptyState
                  variant="inline"
                  title="No equipment requests match"
                  description="Try another stage or search term."
                  action={{ label: "Clear filters", onClick: onClearFilters }}
                />
              ) : (
                <EmptyState
                  variant="inline"
                  icon={<MaterialsIcon />}
                  title="No equipment requests yet"
                  description="Create a rental request or move existing equipment through the lifecycle."
                  action={canRequest ? { label: "Create request", onClick: onAdd } : undefined}
                />
              )}
            </TableEmptyRow>
          ) : (
            requests.map((request) => (
              <EquipmentRequestRow
                key={request.id}
                request={request}
                canRequest={canRequest}
                canApprove={canApprove}
                {...handlers}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

EquipmentRequestsTable.displayName = "EquipmentRequestsTable";

interface EquipmentRequestRowProps extends EquipmentRowHandlers {
  request: EquipmentRequest;
  canRequest: boolean;
  canApprove: boolean;
}

function EquipmentRequestRow({
  request,
  canRequest,
  canApprove,
  onEdit,
  onDelete,
  onCancel,
  onExtend,
  onReturn,
  onAdvance,
}: EquipmentRequestRowProps) {
  const status = EQUIPMENT_STATUS_META[request.status];
  const next = nextEquipmentStatus(request.status);
  const showAdvance = next !== null && canAdvanceTo(next, canRequest, canApprove);
  const subLine = equipmentSubLine(request);
  const closedReason = request.cancelReason ?? request.rejectedReason;
  const money = (value: number) => formatCurrency(value, request.currency);

  const actions = useMemo<RowActionItem[]>(
    () => [
      ...(canApprove && canExtendHire(request.status)
        ? [{ label: "Extend hire", onSelect: () => onExtend(request) }]
        : []),
      ...(canApprove && canReturnHire(request.status)
        ? [{ label: "Return plant", onSelect: () => onReturn(request) }]
        : []),
      ...(canRequest ? [{ label: "Edit", onSelect: () => onEdit(request) }] : []),
      ...(canApprove && canCancelEquipment(request.status)
        ? [{ label: "Cancel hire", tone: "danger" as const, onSelect: () => onCancel(request) }]
        : []),
      ...(canApprove && canDeleteEquipment(request.status)
        ? [{ label: "Delete", tone: "danger" as const, onSelect: () => onDelete(request) }]
        : []),
    ],
    [request, canRequest, canApprove, onEdit, onDelete, onCancel, onExtend, onReturn],
  );

  return (
    <TableRow
      tone={request.status === "Cancelled" ? "muted" : "default"}
      onClick={canRequest ? () => onEdit(request) : undefined}
    >
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-ink">
            {request.quantity} × {request.equipmentName}
          </span>
          {request.plantRef ? (
            <Badge tone="neutral" variant="outline" size="sm">
              {request.plantRef}
            </Badge>
          ) : null}
        </div>
        {subLine ? <p className="mt-0.5 text-xs text-ink-muted">{subLine}</p> : null}
        {closedReason ? (
          <p className="mt-0.5 text-xs text-negative-500 text-pretty">{closedReason}</p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatEquipmentSpan(request.neededFrom, request.neededUntil)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatEquipmentSpan(request.onHireAt, request.offHireAt)}
        {request.hireDays !== null ? (
          <p className="mt-0.5 text-xs text-ink-muted">
            {request.hireDays} day{request.hireDays === 1 ? "" : "s"} hire
            {request.extensions.length > 0
              ? ` · extended ${request.extensions.length}×`
              : ""}
          </p>
        ) : null}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {request.dailyRate === null ? "—" : money(request.dailyRate)}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums">
        {money(request.estimatedCost)}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge dot tone={status.tone} size="sm">
            {status.label}
          </Badge>
          {request.late ? (
            <Badge dot tone="danger" size="sm">
              Late
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {showAdvance && next ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="whitespace-nowrap"
              onClick={() => onAdvance(request, next)}
            >
              Move to {EQUIPMENT_STATUS_META[next].label}
            </Button>
          ) : null}
          {actions.length > 0 ? (
            <RowActionsMenu
              ariaLabel={`Actions for ${request.equipmentName}`}
              items={actions}
            />
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

EquipmentRequestRow.displayName = "EquipmentRequestRow";
