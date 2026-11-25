import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import type { PurchaseOrder } from "@/hooks/use-purchase-orders";
import { formatCurrency, formatLongDate } from "@/lib/formatters";
import {
  PO_ACTION_LABEL,
  PO_STATUS_META,
  availableActions,
  canDeletePurchaseOrder,
  canEditLines,
  type PurchaseOrderAction,
} from "./purchase-order-model";

const COLUMNS = ["Purchase order", "Stage", "Expected", "Value", "Received", "Status"] as const;
const COLUMN_COUNT = COLUMNS.length + 1;
const HEADER_CELL = "h-[52px] px-[24px] py-0 text-caption-l font-medium normal-case text-[#525252]";
const BODY_CELL = "px-[24px] py-0 text-caption-l text-[#1E1E1E]";

/** Column widths as shares of the 1116px design table; Status is wide enough for "Partially received". */
const COLUMN_WIDTHS = ["14.2%", "15.5%", "16.3%", "19.4%", "17.0%", "12.7%", "4.9%"] as const;

export interface PurchaseOrderRowHandlers {
  onOpen: (purchaseOrder: PurchaseOrder) => void;
  onEdit: (purchaseOrder: PurchaseOrder) => void;
  onDelete: (purchaseOrder: PurchaseOrder) => void;
  onAction: (purchaseOrder: PurchaseOrder, action: PurchaseOrderAction) => void;
}

interface PurchaseOrdersTableProps extends PurchaseOrderRowHandlers {
  purchaseOrders: PurchaseOrder[];
  isPending: boolean;
  isFiltered: boolean;
  canManage: boolean;
  currency: string;
  onCreate: () => void;
  onClearFilters: () => void;
}

/** The PO register: what is on order with whom, and how far along it is. */
export function PurchaseOrdersTable({
  purchaseOrders,
  isPending,
  isFiltered,
  canManage,
  currency,
  onCreate,
  onClearFilters,
  ...handlers
}: PurchaseOrdersTableProps) {
  return (
    <div className="border border-[#EEEEEE] bg-white">
      <Table className="min-w-[960px] table-fixed">
        <colgroup>
          {COLUMN_WIDTHS.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <TableHead>
          <tr>
            {COLUMNS.map((column) => (
              <TableHeaderCell key={column} className={HEADER_CELL}>
                {column}
              </TableHeaderCell>
            ))}
            <TableHeaderCell className={HEADER_CELL}>
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
              {isFiltered ? (
                <EmptyState
                  variant="inline"
                  title="No purchase orders match these filters"
                  description="Try adjusting your search or dates."
                  action={{ label: "Clear filters", onClick: onClearFilters }}
                />
              ) : (
                <EmptyState
                  variant="inline"
                  icon={<FinancesIcon />}
                  title="No purchase orders yet"
                  description="Raise a PO from an approved material request, or create one here. Issuing it is what commits the spend."
                  action={canManage ? { label: "New Purchase Order", onClick: onCreate } : undefined}
                />
              )}
            </TableEmptyRow>
          ) : (
            purchaseOrders.map((purchaseOrder) => (
              <PurchaseOrderRow key={purchaseOrder.id} purchaseOrder={purchaseOrder} canManage={canManage} currency={currency} {...handlers} />
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

function PurchaseOrderRow({ purchaseOrder, canManage, currency, onOpen, onEdit, onDelete, onAction }: RowProps) {
  const meta = PO_STATUS_META[purchaseOrder.status];

  // Open, the forward actions, Edit, Delete — and Cancel last, in red.
  const actions = useMemo<RowActionItem[]>(() => {
    const available = canManage ? availableActions(purchaseOrder.status) : [];
    const forward = available.filter((action) => action !== "cancel");
    return [
      { label: "Open", onSelect: () => onOpen(purchaseOrder) },
      ...forward.map((action) => ({ label: PO_ACTION_LABEL[action], onSelect: () => onAction(purchaseOrder, action) })),
      ...(canManage && canEditLines(purchaseOrder.status) ? [{ label: "Edit", onSelect: () => onEdit(purchaseOrder) }] : []),
      ...(canManage && canDeletePurchaseOrder(purchaseOrder.status)
        ? [{ label: "Delete", tone: "danger" as const, onSelect: () => onDelete(purchaseOrder) }]
        : []),
      ...(available.includes("cancel")
        ? [{ label: PO_ACTION_LABEL.cancel, tone: "danger" as const, onSelect: () => onAction(purchaseOrder, "cancel") }]
        : []),
    ];
  }, [purchaseOrder, canManage, onOpen, onEdit, onDelete, onAction]);

  return (
    <TableRow tone={purchaseOrder.status === "Cancelled" ? "muted" : "default"} onClick={() => onOpen(purchaseOrder)} className="h-[68px] border-[#EEEEEE]">
      <TableCell className={BODY_CELL}>
        <p className="truncate">{purchaseOrder.poNumber}</p>
        <p className="truncate text-caption-m text-[#737373]">
          {purchaseOrder.vendorName}
          {purchaseOrder.materialOrderId ? " · from a material request" : ""}
        </p>
        {purchaseOrder.overReceipt ? <p className="truncate text-caption-m text-[#BB4D00]">Over-receipt</p> : null}
        {purchaseOrder.cancelReason ? <p className="truncate text-caption-m text-negative-500">{purchaseOrder.cancelReason}</p> : null}
      </TableCell>
      <TableCell className={BODY_CELL}>
        <p className="truncate">{purchaseOrder.stageName ?? "Unassigned"}</p>
      </TableCell>
      <TableCell className={`${BODY_CELL} whitespace-nowrap`}>{formatLongDate(purchaseOrder.expectedDate) || "—"}</TableCell>
      <TableCell className={`${BODY_CELL} whitespace-nowrap tabular-nums`}>{formatCurrency(purchaseOrder.total, currency)}</TableCell>
      <TableCell className={`${BODY_CELL} whitespace-nowrap tabular-nums`}>{formatCurrency(purchaseOrder.receivedTotal, currency)}</TableCell>
      <TableCell className={BODY_CELL}>
        <Badge tone={meta.tone} size="md" className="h-[24px] whitespace-nowrap text-caption-m font-medium">
          {meta.label}
        </Badge>
      </TableCell>
      <TableCell className="py-0 pl-0 pr-[18px]" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <RowActionsMenu ariaLabel={`Actions for ${purchaseOrder.poNumber}`} items={actions} appearance="house" />
        </div>
      </TableCell>
    </TableRow>
  );
}

PurchaseOrderRow.displayName = "PurchaseOrderRow";
