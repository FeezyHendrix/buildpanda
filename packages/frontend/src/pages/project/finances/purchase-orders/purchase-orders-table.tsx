import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
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
import type { PurchaseOrder } from "@/hooks/use-purchase-orders";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import {
  PO_ACTION_LABEL,
  PO_STATUS_META,
  availableActions,
  canDeletePurchaseOrder,
  canEditLines,
  type PurchaseOrderAction,
} from "./purchase-order-model";

const COLUMN_COUNT = 7;

export interface PurchaseOrderRowHandlers {
  onOpen: (purchaseOrder: PurchaseOrder) => void;
  onEdit: (purchaseOrder: PurchaseOrder) => void;
  onDelete: (purchaseOrder: PurchaseOrder) => void;
  onAction: (purchaseOrder: PurchaseOrder, action: PurchaseOrderAction) => void;
}

interface PurchaseOrdersTableProps extends PurchaseOrderRowHandlers {
  purchaseOrders: PurchaseOrder[];
  isPending: boolean;
  canManage: boolean;
  currency: string;
  onCreate: () => void;
}

/** The PO register: what is on order with whom, and how far along it is. */
export function PurchaseOrdersTable({
  purchaseOrders,
  isPending,
  canManage,
  currency,
  onCreate,
  ...handlers
}: PurchaseOrdersTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[1020px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Purchase order</TableHeaderCell>
            <TableHeaderCell>Stage</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Expected</TableHeaderCell>
            <TableHeaderCell align="right">Value</TableHeaderCell>
            <TableHeaderCell align="right">Received</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
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
          ) : purchaseOrders.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <EmptyState
                variant="inline"
                icon={<FinancesIcon />}
                title="No purchase orders yet"
                description="Raise a PO from an approved material request, or create one here. Issuing it is what commits the spend."
                action={canManage ? { label: "New purchase order", onClick: onCreate } : undefined}
              />
            </TableEmptyRow>
          ) : (
            purchaseOrders.map((purchaseOrder) => (
              <PurchaseOrderRow
                key={purchaseOrder.id}
                purchaseOrder={purchaseOrder}
                canManage={canManage}
                currency={currency}
                {...handlers}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

PurchaseOrdersTable.displayName = "PurchaseOrdersTable";

interface RowProps extends PurchaseOrderRowHandlers {
  purchaseOrder: PurchaseOrder;
  canManage: boolean;
  currency: string;
}

function PurchaseOrderRow({
  purchaseOrder,
  canManage,
  currency,
  onOpen,
  onEdit,
  onDelete,
  onAction,
}: RowProps) {
  const meta = PO_STATUS_META[purchaseOrder.status];

  const actions = useMemo<RowActionItem[]>(
    () => [
      { label: "Open", onSelect: () => onOpen(purchaseOrder) },
      ...(canManage
        ? availableActions(purchaseOrder.status).map((action) => ({
            label: PO_ACTION_LABEL[action],
            tone: action === "cancel" ? ("danger" as const) : ("default" as const),
            onSelect: () => onAction(purchaseOrder, action),
          }))
        : []),
      ...(canManage && canEditLines(purchaseOrder.status)
        ? [{ label: "Edit", onSelect: () => onEdit(purchaseOrder) }]
        : []),
      ...(canManage && canDeletePurchaseOrder(purchaseOrder.status)
        ? [{ label: "Delete", tone: "danger" as const, onSelect: () => onDelete(purchaseOrder) }]
        : []),
    ],
    [purchaseOrder, canManage, onOpen, onEdit, onDelete, onAction],
  );

  return (
    <TableRow
      tone={purchaseOrder.status === "Cancelled" ? "muted" : "default"}
      onClick={() => onOpen(purchaseOrder)}
    >
      <TableCell>
        <p className="font-medium text-ink">{purchaseOrder.poNumber}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {purchaseOrder.vendorName}
          {purchaseOrder.materialOrderId ? " · from a material request" : ""}
        </p>
        {purchaseOrder.cancelReason ? (
          <p className="mt-0.5 text-xs text-negative-500 text-pretty">
            {purchaseOrder.cancelReason}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="text-gray-600">{purchaseOrder.stageName ?? "Unassigned"}</TableCell>
      <TableCell className="whitespace-nowrap">
        {formatShortDate(purchaseOrder.expectedDate) || "—"}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums">
        {formatCurrency(purchaseOrder.total, currency)}
        <p className="mt-0.5 text-xs font-normal text-ink-muted">
          {purchaseOrder.committed ? "Committed" : "Not committed"}
        </p>
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {formatCurrency(purchaseOrder.receivedTotal, currency)}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge dot tone={meta.tone} size="sm">
            {meta.label}
          </Badge>
          {purchaseOrder.overReceipt ? (
            <Badge tone="warning" size="sm">
              Over-receipt
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <RowActionsMenu
            ariaLabel={`Actions for ${purchaseOrder.poNumber}`}
            items={actions}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

PurchaseOrderRow.displayName = "PurchaseOrderRow";
