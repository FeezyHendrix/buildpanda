import { useEffect, useRef } from "react";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { currencySymbol, formatCurrency } from "@/lib/formatters";
import { formatQty } from "./shared";

interface OrderPricingFieldsProps {
  currency: string;
  quantity: number;
  unit: string;
  unitRate: string;
  onUnitRateChange: (value: string) => void;
  estimatedCost: string;
  onEstimatedCostChange: (value: string) => void;
}

/**
 * A QS prices an order as rate × quantity, because that is what reconciles to
 * the BoQ rate and to a part delivery. The lump sum stays editable for orders
 * that genuinely are one — typing a rate just takes the sum over.
 */
export function OrderPricingFields({
  currency,
  quantity,
  unit,
  unitRate,
  onUnitRateChange,
  estimatedCost,
  onEstimatedCostChange,
}: OrderPricingFieldsProps) {
  const symbol = currencySymbol(currency);
  const rate = unitRate.trim() === "" ? null : Number(unitRate);
  const hasRate = rate !== null && Number.isFinite(rate) && rate > 0;
  const computed = hasRate && quantity > 0 ? Math.round(rate * quantity * 100) / 100 : null;

  // Keep the lump sum in step with rate × quantity without making the cost
  // field read-only: the derived figure wins whenever a rate is in play.
  const applied = useRef<number | null>(null);
  useEffect(() => {
    if (computed === null || applied.current === computed) return;
    applied.current = computed;
    onEstimatedCostChange(String(computed));
  }, [computed, onEstimatedCostChange]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line-hair p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-rate">Unit rate</Label>
          <MoneyInput
            id="mat-rate"
            value={unitRate}
            onChange={onUnitRateChange}
            currencySymbol={symbol}
            placeholder="0.00"
          />
          <p className="text-xs text-ink-muted">Per {unit.trim() || "unit"}.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mat-cost">Estimated cost</Label>
          <MoneyInput
            id="mat-cost"
            value={estimatedCost}
            onChange={onEstimatedCostChange}
            currencySymbol={symbol}
            placeholder="0.00"
          />
          <p className="text-xs text-ink-muted">
            {computed === null ? "Lump sum — add a rate to derive it." : "Rate × quantity."}
          </p>
        </div>
      </div>
      {computed === null ? null : (
        <p className="text-sm text-ink tabular-nums">
          {formatCurrency(rate ?? 0, currency)} × {formatQty(quantity)} {unit.trim()} ={" "}
          <span className="font-semibold">{formatCurrency(computed, currency)}</span>
        </p>
      )}
    </div>
  );
}

OrderPricingFields.displayName = "OrderPricingFields";
