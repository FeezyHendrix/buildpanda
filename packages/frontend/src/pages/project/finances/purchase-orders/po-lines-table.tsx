import type { ReactNode } from "react";
import { Badge } from "@/components/atoms/badge";
import type { PurchaseOrderItem } from "@/hooks/use-purchase-orders";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { LinesBand } from "./po-parts";

/**
 * The read-only lines of a PO under the grey band, used by the detail sheet and
 * the receive sheet. The band's text sits 4px left of the cells, as designed.
 * A trailing column is optional: the receive sheet puts its "Received now"
 * input there.
 */
const BAND_LABELS = ["Description", "QTY", "Unit", "Rate", "Amount"] as const;
const LEAD_BAND = "213px 99px 99px 110px 1fr";
const LEAD_ROW = "217px 99px 99px 110px 1fr";

interface PoLinesTableProps {
  items: PurchaseOrderItem[];
  currency: string;
  /** Header label and cell for an extra last column. */
  trailing?: { label: string; render: (item: PurchaseOrderItem) => ReactNode };
}

function QuantityCell({ item }: { item: PurchaseOrderItem }) {
  return (
    <div className="tabular-nums">
      <p>
        {item.quantity}
        {item.overReceived ? (
          <Badge tone="warning" size="sm" className="ml-[6px]">
            Over
          </Badge>
        ) : null}
      </p>
      {item.receivedQuantity > 0 ? <p className="text-caption-m text-[#737373]">{item.receivedQuantity} received</p> : null}
    </div>
  );
}

export function PoLinesTable({ items, currency, trailing }: PoLinesTableProps) {
  const bandColumns = trailing ? `${LEAD_BAND} 160px` : LEAD_BAND;
  const rowColumns = trailing ? `${LEAD_ROW} 140px` : LEAD_ROW;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <LinesBand columns={bandColumns} labels={trailing ? [...BAND_LABELS, trailing.label] : BAND_LABELS} />
        {items.map((item) => (
          <div key={item.id} className="mx-[20px] border-b border-[#EEEEEE]">
            <div
              className={cn("grid min-h-[59px] items-center py-[8px] text-caption-l text-[#1E1E1E]")}
              style={{ gridTemplateColumns: rowColumns }}
            >
              <p className="min-w-0 break-words pr-[12px]">{item.description}</p>
              <QuantityCell item={item} />
              <p className="text-[#737373]">—</p>
              <p className="truncate pr-[8px] tabular-nums">{formatCurrency(item.unitPrice, currency)}</p>
              <p className="truncate pr-[8px] tabular-nums">{formatCurrency(item.lineTotal, currency)}</p>
              {trailing ? trailing.render(item) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

PoLinesTable.displayName = "PoLinesTable";
