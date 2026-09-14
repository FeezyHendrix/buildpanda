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
import { formatCurrency } from "@/lib/formatters";
import type { MaterialOrder, MaterialOrderStatus } from "@/lib/project-types";
import {
  STATUS_META,
  approvalMeta,
  canCancel,
  canDelete,
  canRecordDelivery,
  deliveryProgress,
  formatDate,
  formatQty,
  nextStatus,
  supplierLabel,
} from "./shared";

/**
 * The material order register: one row per order, carrying what a PM scans —
 * what it is, how much of it has landed, what it costs, when it is needed and
 * where it sits on the procurement ladder.
 */

const COLUMN_COUNT = 8;

/** Advancing into these mirrors the backend's approval guard. */
const APPROVAL_TIER: readonly MaterialOrderStatus[] = ["Approved", "Ordered"];

export interface MaterialRowHandlers {
  onOpen: (order: MaterialOrder) => void;
  onEdit: (order: MaterialOrder) => void;
  onDelete: (order: MaterialOrder) => void;
  onCancel: (order: MaterialOrder) => void;
  onReject: (order: MaterialOrder) => void;
  onRecordDelivery: (order: MaterialOrder) => void;
  onRaisePurchaseOrder: (order: MaterialOrder) => void;
  onAdvance: (order: MaterialOrder, status: MaterialOrderStatus) => void;
}

interface MaterialsTableProps extends MaterialRowHandlers {
  orders: MaterialOrder[];
  /** True when the project has orders but the filters hide them all. */
  isFiltered: boolean;
  isLoading: boolean;
  canRequest: boolean;
  canApprove: boolean;
  /** Raising a PO is a finance act, not a materials one. */
  canRaisePurchaseOrder: boolean;
  onCreate: () => void;
  onClearFilters: () => void;
}

export function MaterialsTable({
  orders,
  isFiltered,
  isLoading,
  canRequest,
  canApprove,
  canRaisePurchaseOrder,
  onCreate,
  onClearFilters,
  ...handlers
}: MaterialsTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[1080px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Material</TableHeaderCell>
            <TableHeaderCell align="right">Quantity</TableHeaderCell>
            <TableHeaderCell align="right">Unit rate</TableHeaderCell>
            <TableHeaderCell align="right">Estimated cost</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Needed by</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Expected delivery</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right" className="w-[72px]">
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableEmptyRow colSpan={COLUMN_COUNT} className="py-12">
              <div className="flex items-center justify-center">
                <Spinner size="md" />
              </div>
            </TableEmptyRow>
          ) : orders.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              {isFiltered ? (
                <EmptyState
                  variant="inline"
                  title="No orders match these filters"
                  description="Try another status, supplier or search term."
                  action={{ label: "Clear filters", onClick: onClearFilters }}
                />
              ) : (
                <EmptyState
                  variant="inline"
                  icon={<MaterialsIcon />}
                  title="No material orders yet"
                  description="Create the first request and tie it to the phase and site activity it unlocks."
                  action={canRequest ? { label: "Create order", onClick: onCreate } : undefined}
                />
              )}
            </TableEmptyRow>
          ) : (
            orders.map((order) => (
              <MaterialOrderTableRow
                key={order.id}
                order={order}
                canRequest={canRequest}
                canApprove={canApprove}
                canRaisePurchaseOrder={canRaisePurchaseOrder}
                {...handlers}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

MaterialsTable.displayName = "MaterialsTable";

interface RowProps extends MaterialRowHandlers {
  order: MaterialOrder;
  canRequest: boolean;
  canApprove: boolean;
  canRaisePurchaseOrder: boolean;
}

function MaterialOrderTableRow({
  order,
  canRequest,
  canApprove,
  canRaisePurchaseOrder,
  onOpen,
  onEdit,
  onDelete,
  onCancel,
  onReject,
  onRecordDelivery,
  onRaisePurchaseOrder,
  onAdvance,
}: RowProps) {
  const status = STATUS_META[order.status];
  const approval = approvalMeta(order.approvalStatus);
  const next = nextStatus(order.status);
  const canAdvance = next !== null && (APPROVAL_TIER.includes(next) ? canApprove : canRequest);
  const subLine = [supplierLabel(order), order.phaseName, order.activityName]
    .filter(Boolean)
    .join(" · ");
  const closedReason = order.cancelReason ?? order.rejectedReason;

  const actions = useMemo<RowActionItem[]>(
    () => [
      { label: "View deliveries", onSelect: () => onOpen(order) },
      ...(next && canAdvance
        ? [{ label: `Move to ${STATUS_META[next].label}`, onSelect: () => onAdvance(order, next) }]
        : []),
      ...(canApprove && canRecordDelivery(order.status)
        ? [{ label: "Record delivery", onSelect: () => onRecordDelivery(order) }]
        : []),
      ...(canRaisePurchaseOrder && (order.status === "Approved" || order.status === "Ordered")
        ? [{ label: "Raise a purchase order", onSelect: () => onRaisePurchaseOrder(order) }]
        : []),
      ...(canRequest ? [{ label: "Edit", onSelect: () => onEdit(order) }] : []),
      ...(canApprove && canCancel(order.status)
        ? [
            { label: "Cancel order", onSelect: () => onCancel(order) },
            { label: "Reject", tone: "danger" as const, onSelect: () => onReject(order) },
          ]
        : []),
      ...(canApprove && canDelete(order.status)
        ? [{ label: "Delete", tone: "danger" as const, onSelect: () => onDelete(order) }]
        : []),
    ],
    [
      order,
      next,
      canAdvance,
      canRequest,
      canApprove,
      canRaisePurchaseOrder,
      onOpen,
      onAdvance,
      onEdit,
      onDelete,
      onCancel,
      onReject,
      onRecordDelivery,
      onRaisePurchaseOrder,
    ],
  );

  return (
    <TableRow
      tone={order.status === "Cancelled" || order.status === "Rejected" ? "muted" : "default"}
      onClick={() => onOpen(order)}
    >
      <TableCell>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-ink">{order.materialName}</span>
          {order.title && order.title !== order.materialName ? (
            <span className="text-[13px] text-gray-600">{order.title}</span>
          ) : null}
        </div>
        {subLine ? <p className="mt-0.5 text-xs text-ink-muted">{subLine}</p> : null}
        {closedReason ? (
          <p className="mt-0.5 text-xs text-negative-500 text-pretty">{closedReason}</p>
        ) : null}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        <p className="font-medium">
          {formatQty(order.quantity)} {order.unit}
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">{deliveryProgress(order)}</p>
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {order.unitRate === null || order.unitRate === undefined
          ? "—"
          : formatCurrency(order.unitRate, order.currency)}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums">
        {formatCurrency(order.estimatedCost, order.currency)}
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatDate(order.neededBy)}</TableCell>
      <TableCell className="whitespace-nowrap">{formatDate(order.expectedDeliveryAt)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge dot tone={status.tone} size="sm">
            {status.label}
          </Badge>
          {order.late ? (
            <Badge tone="danger" size="sm">
              Late
            </Badge>
          ) : null}
          {approval ? (
            <Badge tone={approval.tone} size="sm" variant="outline">
              {approval.label}
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
        {actions.length > 0 ? (
          <div className="flex justify-end">
            <RowActionsMenu ariaLabel={`Actions for ${order.materialName}`} items={actions} />
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

MaterialOrderTableRow.displayName = "MaterialOrderTableRow";
