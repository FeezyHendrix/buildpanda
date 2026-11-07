import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { EmptyState } from "@/components/molecules/empty-state";
import type { StockLevel } from "@/lib/project-types";
import { StackIcon } from "./icons";
import { displayUnit, formatQty, stockAlert } from "./shared";

/** One row of five cards before "View All" opens the rest. */
const COLLAPSED_COUNT = 5;

function StockTile({
  stock,
  canManage,
  onEditPolicy,
}: {
  stock: StockLevel;
  canManage: boolean;
  onEditPolicy: () => void;
}) {
  const alert = stockAlert(stock);

  return (
    <div className="flex flex-col border-[0.5px] border-[#EBEBEB] bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-[#EBEBEB] px-4 py-2.5">
        <p title={stock.materialName} className="truncate text-caption-l! font-semibold text-black-500">
          {stock.materialName}
        </p>
        {alert ? (
          <Badge tone={alert.tone} size="sm" className="shrink-0">
            <alert.Icon className="size-3" />
            {alert.label}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <p className="flex items-baseline gap-1 tabular-nums text-black-500">
          <span className="text-2xl font-medium">{formatQty(stock.onHandQty)}</span>
          <span className="text-base font-normal text-gray-500">{displayUnit(stock.unit)}</span>
        </p>
        {canManage ? (
          <button
            type="button"
            onClick={onEditPolicy}
            aria-label={`Reorder policy for ${stock.materialName}`}
            className="self-start text-caption-l! font-medium text-primary hover:underline"
          >
            Reorder Policy
          </button>
        ) : null}
      </div>
    </div>
  );
}

StockTile.displayName = "StockTile";

interface StockByMaterialProps {
  stock: StockLevel[];
  canManage: boolean;
  onLogMaterial: () => void;
  onEditPolicy: (materialId: string) => void;
}

/** What is on hand per material, urgent ones first, with the reorder policy one click away. */
export function StockByMaterial({ stock, canManage, onLogMaterial, onEditPolicy }: StockByMaterialProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? stock : stock.slice(0, COLLAPSED_COUNT);

  return (
    <section aria-labelledby="stock-heading" className="mt-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="stock-heading" className="text-xl font-semibold text-black-500">
          Stock by material
        </h2>
        {stock.length > COLLAPSED_COUNT ? (
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            aria-expanded={showAll}
            className="inline-flex items-center gap-1.5 text-caption-l! font-medium text-primary hover:underline"
          >
            <ArrowUpRight className="size-4" />
            {showAll ? "Show fewer" : "View All Stocks by Material"}
          </button>
        ) : null}
      </div>

      {stock.length === 0 ? (
        <Card padding="none">
          <EmptyState
            variant="inline"
            icon={<StackIcon />}
            title="No stock yet"
            description="Log the first delivery and this project's running stock levels will build up here."
            action={canManage ? { label: "Log material", onClick: onLogMaterial } : undefined}
            className="px-6"
          />
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {visible.map((s) => (
            <StockTile
              key={`${s.materialId}-${s.locationKey}`}
              stock={s}
              canManage={canManage}
              onEditPolicy={() => onEditPolicy(s.materialId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

StockByMaterial.displayName = "StockByMaterial";
