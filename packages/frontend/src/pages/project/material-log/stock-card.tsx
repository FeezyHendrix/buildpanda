import { Card } from "@/components/atoms/card";
import { Badge } from "@/components/atoms/badge";
import { cn } from "@/lib/utils";
import type { StockLevel } from "@/lib/project-types";

export function StockCard({ stock }: { stock: StockLevel }) {
  return (
    <Card padding="md" className="flex flex-col gap-1">
      <span className="truncate text-sm font-medium text-gray-900">{stock.materialName}</span>
      <span className={cn("text-2xl font-semibold tabular-nums", stock.onHandQty < 0 ? "text-red-600" : "text-gray-900")}>
        {stock.onHandQty}
        <span className="ml-1 text-xs font-normal text-gray-400">{stock.unit}</span>
      </span>
      {stock.onHandQty < 0 ? (
        <Badge tone="danger" size="sm">Negative</Badge>
      ) : stock.lowStock ? (
        <Badge tone="warning" size="sm">Low stock</Badge>
      ) : null}
    </Card>
  );
}
