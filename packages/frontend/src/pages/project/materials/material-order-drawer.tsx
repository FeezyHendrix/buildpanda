import { Badge } from "@/components/atoms/badge";
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
import { DetailDrawer } from "@/components/molecules/detail-drawer";
import { useMaterialDeliveries } from "@/hooks/use-materials-equipment";
import { formatCurrency } from "@/lib/formatters";
import type { MaterialDelivery, MaterialOrder } from "@/lib/project-types";
import { approvalMeta, STATUS_META, deliveryProgress, formatDate, formatQty, supplierLabel } from "./shared";

interface MaterialOrderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  order: MaterialOrder;
}

function DeliveryRow({ delivery, unit }: { delivery: MaterialDelivery; unit: string }) {
  return (
    <TableRow tone={delivery.rejected ? "danger" : "default"}>
      <TableCell className="whitespace-nowrap">{formatDate(delivery.deliveredAt)}</TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {formatQty(delivery.deliveredQty)} {unit}
      </TableCell>
      <TableCell>
        <p className="whitespace-nowrap">{delivery.deliveryNote ?? "No DN"}</p>
        {delivery.receivedByName ? (
          <p className="mt-0.5 text-xs text-ink-muted">Signed by {delivery.receivedByName}</p>
        ) : null}
      </TableCell>
      <TableCell>
        {delivery.rejected ? (
          <div className="flex flex-col gap-1">
            <Badge dot tone="danger" size="sm">
              Rejected
            </Badge>
            {delivery.rejectedReason ? (
              <span className="text-xs text-ink-muted">{delivery.rejectedReason}</span>
            ) : null}
          </div>
        ) : (
          <Badge dot tone="success" size="sm">
            Accepted
          </Badge>
        )}
      </TableCell>
    </TableRow>
  );
}

DeliveryRow.displayName = "DeliveryRow";

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ink-muted">{label}</span>
      <span className="text-sm font-medium text-ink tabular-nums">{value}</span>
    </div>
  );
}

/** The order, everything recorded against it, and every drop it has taken. */
export function MaterialOrderDrawer({
  open,
  onOpenChange,
  projectId,
  order,
}: MaterialOrderDrawerProps) {
  const { data: deliveries = [], isPending } = useMaterialDeliveries(
    open ? projectId : undefined,
    open ? order.id : undefined,
  );
  const status = STATUS_META[order.status];
  const approval = approvalMeta(order.approvalStatus);
  const closedReason = order.cancelReason ?? order.rejectedReason;

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={order.materialName}
      width="lg"
      headerMeta={
        <>
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
          <span className="text-xs text-ink-muted">
            {[supplierLabel(order), order.phaseName, order.activityName].filter(Boolean).join(" · ") ||
              "Not linked to the programme"}
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-5 px-6 py-5">
        {closedReason ? (
          <div className="rounded-lg border border-negative-500/40 bg-negative-50 p-3">
            <p className="text-xs font-semibold uppercase text-negative-500">
              {order.status === "Rejected" ? "Rejected" : "Cancelled"}
            </p>
            <p className="mt-0.5 text-sm text-ink text-pretty">{closedReason}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Line label="Ordered" value={`${formatQty(order.quantity)} ${order.unit}`} />
          <Line label="Delivered" value={deliveryProgress(order)} />
          <Line
            label="Unit rate"
            value={
              order.unitRate === null || order.unitRate === undefined
                ? "—"
                : formatCurrency(order.unitRate, order.currency)
            }
          />
          <Line label="Estimated cost" value={formatCurrency(order.estimatedCost, order.currency)} />
          <Line label="Needed by" value={formatDate(order.neededBy)} />
          <Line label="Expected delivery" value={formatDate(order.expectedDeliveryAt)} />
        </div>

        {order.notes ? (
          <div>
            <p className="text-xs font-medium uppercase text-ink-muted">Lifecycle notes</p>
            <p className="mt-1 text-sm text-ink text-pretty">{order.notes}</p>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-medium uppercase text-ink-muted">Deliveries</p>
          <div className="mt-2 overflow-hidden rounded-lg border border-line-hair">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell align="right">Received</TableHeaderCell>
                  <TableHeaderCell>Delivery note</TableHeaderCell>
                  <TableHeaderCell>Outcome</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {isPending ? (
                  <TableEmptyRow colSpan={4} className="py-8">
                    <div className="flex items-center justify-center">
                      <Spinner size="md" />
                    </div>
                  </TableEmptyRow>
                ) : deliveries.length === 0 ? (
                  <TableEmptyRow colSpan={4}>
                    <p className="py-6 text-center text-sm text-ink-muted">
                      Nothing has arrived yet. Recording a delivery books the stock and the cost.
                    </p>
                  </TableEmptyRow>
                ) : (
                  deliveries.map((delivery) => (
                    <DeliveryRow key={delivery.id} delivery={delivery} unit={order.unit} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DetailDrawer>
  );
}

MaterialOrderDrawer.displayName = "MaterialOrderDrawer";
