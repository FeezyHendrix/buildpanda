import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { DetailDrawer } from "@/components/molecules/detail-drawer";
import type { PurchaseOrder, PurchaseOrderItem } from "@/hooks/use-purchase-orders";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import {
  PO_ACTION_LABEL,
  PO_STATUS_META,
  availableActions,
  canEditLines,
  type PurchaseOrderAction,
} from "./purchase-order-model";
import { PoMetric } from "./po-metric";

interface PurchaseOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: PurchaseOrder;
  currency: string;
  canManage: boolean;
  onEdit: () => void;
  onAction: (action: PurchaseOrderAction) => void;
  busyAction: PurchaseOrderAction | null;
}

function LineRow({ item, currency }: { item: PurchaseOrderItem; currency: string }) {
  return (
    <TableRow tone={item.overReceived ? "muted" : "default"}>
      <TableCell>
        <p className="font-medium text-ink">{item.description}</p>
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {item.quantity}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {item.receivedQuantity}
        {item.overReceived ? (
          <Badge tone="warning" size="sm" className="ml-1.5">
            Over
          </Badge>
        ) : null}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {formatCurrency(item.unitPrice, currency)}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums">
        {formatCurrency(item.lineTotal, currency)}
      </TableCell>
    </TableRow>
  );
}

LineRow.displayName = "LineRow";

/**
 * A PO moves through actions, never a status dropdown: issue puts it with the
 * vendor and commits the spend, receive records what arrived line by line,
 * cancel keeps it on file with a reason, close settles it.
 */
export function PurchaseOrderDrawer({
  open,
  onOpenChange,
  purchaseOrder,
  currency,
  canManage,
  onEdit,
  onAction,
  busyAction,
}: PurchaseOrderDrawerProps) {
  const meta = PO_STATUS_META[purchaseOrder.status];
  const actions = availableActions(purchaseOrder.status);

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={purchaseOrder.poNumber}
      width="lg"
      headerMeta={
        <>
          <Badge dot tone={meta.tone} size="sm">
            {meta.label}
          </Badge>
          {purchaseOrder.committed ? (
            <Badge tone="info" size="sm" variant="outline">
              Committed spend
            </Badge>
          ) : null}
          {purchaseOrder.overReceipt ? (
            <Badge tone="warning" size="sm">
              Over-receipt
            </Badge>
          ) : null}
          <span className="text-xs text-ink-muted">
            {[purchaseOrder.vendorName, purchaseOrder.stageName].filter(Boolean).join(" · ")}
          </span>
        </>
      }
      footer={
        canManage ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action}
                type="button"
                variant={action === "cancel" ? "ghost" : "primary"}
                size="sm"
                loading={busyAction === action}
                onClick={() => onAction(action)}
              >
                {PO_ACTION_LABEL[action]}
              </Button>
            ))}
            {canEditLines(purchaseOrder.status) ? (
              <Button type="button" variant="secondary" size="sm" onClick={onEdit}>
                Edit
              </Button>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-5 px-6 py-5">
        {purchaseOrder.cancelReason ? (
          <div className="rounded-lg border border-negative-500/40 bg-negative-50 p-3">
            <p className="text-xs font-semibold uppercase text-negative-500">
              Cancelled {formatShortDate(purchaseOrder.cancelledAt)}
            </p>
            <p className="mt-0.5 text-sm text-ink text-pretty">{purchaseOrder.cancelReason}</p>
          </div>
        ) : null}

        {canEditLines(purchaseOrder.status) ? null : (
          <p className="rounded-lg bg-surface-alt p-3 text-sm text-ink-muted text-pretty">
            The lines on this PO are fixed — a received or closed order cannot have its quantities
            rewritten. Raise a new PO for anything further.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <PoMetric label="PO value" value={formatCurrency(purchaseOrder.total, currency)} accent />
          <PoMetric
            label="Received value"
            value={formatCurrency(purchaseOrder.receivedTotal, currency)}
          />
          <PoMetric label="Lines" value={String(purchaseOrder.items.length)} />
          <PoMetric label="Ordered" value={formatShortDate(purchaseOrder.orderDate) || "—"} />
          <PoMetric label="Issued" value={formatShortDate(purchaseOrder.issuedAt) || "Not issued"} />
          <PoMetric label="Expected" value={formatShortDate(purchaseOrder.expectedDate) || "—"} />
        </div>

        {purchaseOrder.notes ? (
          <div>
            <p className="text-xs font-medium uppercase text-ink-muted">Notes</p>
            <p className="mt-1 text-sm text-ink text-pretty">{purchaseOrder.notes}</p>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-medium uppercase text-ink-muted">Line items</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-line-hair">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Description</TableHeaderCell>
                  <TableHeaderCell align="right">Ordered</TableHeaderCell>
                  <TableHeaderCell align="right">Received</TableHeaderCell>
                  <TableHeaderCell align="right">Unit price</TableHeaderCell>
                  <TableHeaderCell align="right">Line total</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {purchaseOrder.items.map((item) => (
                  <LineRow key={item.id} item={item} currency={currency} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DetailDrawer>
  );
}

PurchaseOrderDrawer.displayName = "PurchaseOrderDrawer";
