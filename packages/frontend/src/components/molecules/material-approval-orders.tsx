import { Link } from "react-router-dom";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { useMaterialOrders } from "@/hooks/use-materials-equipment";
import type { MaterialApprovalDetail } from "@/api/material-approvals";
import type { MaterialOrder, MaterialOrderStatus } from "@/lib/project-types";

const ORDER_STATUS: Record<MaterialOrderStatus, { label: string; tone: BadgeTone }> = {
  Draft: { label: "Draft", tone: "neutral" },
  Requested: { label: "Requested", tone: "info" },
  Approved: { label: "Approved", tone: "success" },
  Ordered: { label: "Ordered", tone: "warning" },
  PartiallyDelivered: { label: "Partially delivered", tone: "warning" },
  Delivered: { label: "Delivered", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
  Rejected: { label: "Rejected", tone: "danger" },
};

function qty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function OrderRow({ projectId, order }: { projectId: string; order: MaterialOrder }) {
  const status = ORDER_STATUS[order.status];
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line-hair px-3 py-2">
      <div className="min-w-0 flex-1">
        <Link
          to={`/project/${projectId}/materials?q=${encodeURIComponent(order.title)}`}
          className="block truncate text-sm font-medium text-gray-900 hover:text-primary-600 hover:underline"
        >
          {order.title}
        </Link>
        <p className="text-xs text-ink-muted tabular-nums">
          {qty(order.deliveredQuantity)} of {qty(order.quantity)} {order.unit} delivered
        </p>
      </div>
      <Badge dot tone={status.tone} size="sm">
        {status.label}
      </Badge>
    </li>
  );
}

OrderRow.displayName = "OrderRow";

/**
 * What became of a sign-off: the orders placed against it and how much has
 * arrived. An approved request with no order yet offers to raise one, filled
 * in from the approval so the two cannot drift apart.
 */
export function MaterialApprovalOrders({
  projectId,
  approval,
  canOrder,
}: {
  projectId: string;
  approval: MaterialApprovalDetail;
  canOrder: boolean;
}) {
  const { data: orders = [], isPending } = useMaterialOrders(projectId);
  const linked = orders.filter((order) => order.approvalId === approval.id);
  const delivered = linked.reduce((sum, order) => sum + order.deliveredQuantity, 0);

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase text-ink-muted">
          Orders{linked.length ? ` · ${qty(delivered)} ${approval.unit} delivered` : ""}
        </p>
        {canOrder && approval.status === "Approved" ? (
          <Link
            to={`/project/${projectId}/materials?fromApproval=${approval.id}`}
            className="text-sm font-semibold text-primary-600 hover:underline"
          >
            Order this material
          </Link>
        ) : null}
      </div>
      {isPending ? null : linked.length === 0 ? (
        <p className="py-2 text-sm text-gray-500">
          {approval.status === "Approved"
            ? "Nothing has been ordered against this approval yet."
            : "Orders placed for this material will show here once it is approved."}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {linked.map((order) => (
            <OrderRow key={order.id} projectId={projectId} order={order} />
          ))}
        </ul>
      )}
    </div>
  );
}

MaterialApprovalOrders.displayName = "MaterialApprovalOrders";
