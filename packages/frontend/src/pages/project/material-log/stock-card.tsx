import { Badge } from "@/components/atoms/badge";
import { Card } from "@/components/atoms/card";
import { ProgressBar } from "@/components/atoms/progress-bar";
import type { StockLevel } from "@/lib/project-types";
import { ClipboardCheckIcon } from "./icons";
import { displayUnit, formatMeasure, formatQty, stockAlert } from "./shared";

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-black-500">
        {value}
      </p>
    </div>
  );
}

MiniStat.displayName = "MiniStat";

function ReorderLine({
  stock,
  canManage,
  onEditPolicy,
}: {
  stock: StockLevel;
  canManage?: boolean;
  onEditPolicy?: () => void;
}) {
  const thresholdSet = stock.lowStockThreshold !== null;
  const actionLabel = thresholdSet
    ? `Edit reorder level for ${stock.materialName}`
    : `Set reorder level for ${stock.materialName}`;

  return (
    <div className="flex items-center gap-2 border-t border-[#F0F0F0] px-4 py-2.5">
      <ClipboardCheckIcon className="size-3.5 shrink-0 text-gray-400" />
      <p className="min-w-0 flex-1 truncate text-xs text-gray-500">
        {thresholdSet ? (
          <>
            Reorder below{" "}
            <span className="font-medium tabular-nums text-gray-700">
              {formatMeasure(stock.lowStockThreshold!, stock.unit)}
            </span>
          </>
        ) : (
          "No reorder level set"
        )}
      </p>
      {canManage && onEditPolicy ? (
        <button
          type="button"
          onClick={onEditPolicy}
          title={actionLabel}
          aria-label={actionLabel}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:bg-[#F6F6F6] hover:text-primary-500"
        >
          {thresholdSet ? "Edit" : "Set"}
        </button>
      ) : null}
    </div>
  );
}

ReorderLine.displayName = "ReorderLine";

export function StockCard({
  stock,
  canManage,
  onEditPolicy,
}: {
  stock: StockLevel;
  canManage?: boolean;
  onEditPolicy?: () => void;
}) {
  const onHand = stock.onHandQty;
  const negative = onHand < 0;
  const alert = stockAlert(stock);
  const showMeter = stock.totalReceived > 0;

  return (
    <Card padding="none" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="min-w-0">
          <h3
            title={stock.materialName}
            className="truncate text-sm font-semibold text-black-500"
          >
            {stock.materialName}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Measured in {displayUnit(stock.unit)}
          </p>
        </div>
        {alert ? (
          <Badge tone={alert.tone} size="sm" className="shrink-0">
            <alert.Icon className="size-3" />
            {alert.label}
          </Badge>
        ) : null}
      </div>

      <div className="px-4 pb-4">
        <p className="flex items-baseline gap-1.5 tabular-nums text-black-500">
          <span className="text-[26px] font-semibold leading-none tracking-tight">
            {formatQty(onHand)}
          </span>
          <span className="text-sm font-medium text-gray-500">
            {displayUnit(stock.unit)}
          </span>
        </p>
        <p className="mt-1.5 text-xs text-gray-500">
          On hand — received minus used
        </p>

        {showMeter ? (
          <ProgressBar
            value={stock.totalUsed}
            max={stock.totalReceived}
            size="sm"
            tone={negative ? "danger" : "brand"}
            trackClassName="mt-3 bg-[#F0F0F0]"
            aria-label={`${formatMeasure(stock.totalUsed, stock.unit)} used of ${formatMeasure(stock.totalReceived, stock.unit)} received`}
          />
        ) : null}
      </div>

      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-[#F0F0F0] px-4 py-3">
        <MiniStat
          label="Received"
          value={formatMeasure(stock.totalReceived, stock.unit)}
        />
        <MiniStat
          label="Used"
          value={formatMeasure(stock.totalUsed, stock.unit)}
        />
      </div>

      <ReorderLine
        stock={stock}
        canManage={canManage}
        onEditPolicy={onEditPolicy}
      />
    </Card>
  );
}

StockCard.displayName = "StockCard";
