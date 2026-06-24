import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { IconBox } from "@/components/atoms/icon-box";
import { MaterialsIcon } from "@/components/atoms/project-nav-icons";
import { formatCurrency } from "@/lib/formatters";
import type { MaterialOrder, MaterialOrderStatus } from "@/lib/project-types";
import { STATUS_META, formatDate, nextStatus } from "./shared";

export function MaterialOrderRow({
  order,
  onEdit,
  onDelete,
  onAdvance,
}: {
  order: MaterialOrder;
  onEdit: () => void;
  onDelete: () => void;
  onAdvance: (status: MaterialOrderStatus) => void;
}) {
  const next = nextStatus(order.status);
  return (
    <article className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconBox tone={order.priority === "Critical" ? "red" : "orange"} size="sm" icon={<MaterialsIcon className="size-4" />} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-gray-900">{order.title}</h3>
            <Badge tone={STATUS_META[order.status].tone}>{STATUS_META[order.status].label}</Badge>
            <Badge tone={order.priority === "Critical" ? "danger" : "neutral"} variant="outline">{order.priority}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-600 text-pretty">
            {order.quantity} {order.unit} · {order.materialName}{order.supplier ? ` from ${order.supplier}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>Needed {formatDate(order.neededBy)}</span>
            <span>Phase: {order.phaseName ?? "Unlinked"}</span>
            <span>Activity: {order.activityName ?? "Unlinked"}</span>
            <span>Doc: {order.documentName ?? "No receipt/spec"}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        <p className="mr-2 text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(order.estimatedCost, order.currency)}</p>
        {next && <Button size="sm" variant="secondary" onClick={() => onAdvance(next)}>Move to {STATUS_META[next].label}</Button>}
        <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
      </div>
    </article>
  );
}
