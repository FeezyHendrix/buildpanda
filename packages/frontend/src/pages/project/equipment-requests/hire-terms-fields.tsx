import { useEffect, useRef } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { MoneyInput } from "@/components/atoms/money-input";
import { currencySymbol, formatCurrency } from "@/lib/formatters";
import { hireDaysBetween } from "./equipment-helpers";

export interface HireTerms {
  onHireAt: string;
  offHireAt: string;
  plantRef: string;
  dailyRate: string;
  estimatedCost: string;
}

interface HireTermsFieldsProps {
  currency: string;
  value: HireTerms;
  onChange: (patch: Partial<HireTerms>) => void;
  /** Used for the day count until the plant is actually booked out. */
  fallbackFrom: string;
  fallbackTo: string;
}

function DateField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Plant is hired by the day against a fleet number, so the hire period, the
 * plant reference and the daily rate are the record — the cost follows from
 * rate × days rather than being typed and re-typed when a hire is extended.
 */
export function HireTermsFields({
  currency,
  value,
  onChange,
  fallbackFrom,
  fallbackTo,
}: HireTermsFieldsProps) {
  const symbol = currencySymbol(currency);
  const days =
    hireDaysBetween(value.onHireAt || null, value.offHireAt || null) ??
    hireDaysBetween(fallbackFrom || null, fallbackTo || null);
  const rate = value.dailyRate.trim() === "" ? null : Number(value.dailyRate);
  const hasRate = rate !== null && Number.isFinite(rate) && rate > 0;
  const computed = hasRate && days !== null ? Math.round(rate * days * 100) / 100 : null;

  // The derived figure wins whenever a rate is set; without one the lump sum
  // stays exactly what the user typed.
  const applied = useRef<number | null>(null);
  useEffect(() => {
    if (computed === null || applied.current === computed) return;
    applied.current = computed;
    onChange({ estimatedCost: String(computed) });
  }, [computed, onChange]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line-hair p-4">
      <div className="grid grid-cols-2 gap-3">
        <DateField
          id="eq-on-hire"
          label="On hire from"
          value={value.onHireAt}
          onChange={(next) => onChange({ onHireAt: next })}
          hint="When the plant actually goes on hire."
        />
        <DateField
          id="eq-off-hire"
          label="Off hire on"
          value={value.offHireAt}
          onChange={(next) => onChange({ offHireAt: next })}
          hint="Required before a hire can be returned."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eq-plant-ref">Plant / fleet reference</Label>
          <input
            id="eq-plant-ref"
            value={value.plantRef}
            onChange={(event) => onChange({ plantRef: event.target.value })}
            placeholder="e.g. CAT-140M / FL-0231"
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eq-daily-rate">Daily hire rate</Label>
          <MoneyInput
            id="eq-daily-rate"
            value={value.dailyRate}
            onChange={(next) => onChange({ dailyRate: next })}
            currencySymbol={symbol}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="eq-cost">Estimated hire cost</Label>
        <MoneyInput
          id="eq-cost"
          value={value.estimatedCost}
          onChange={(next) => onChange({ estimatedCost: next })}
          currencySymbol={symbol}
          placeholder="0.00"
        />
        <p className="text-xs text-ink-muted tabular-nums">
          {computed === null
            ? "Lump sum — add a daily rate and a hire period to derive it."
            : `${formatCurrency(rate ?? 0, currency)} × ${days} day${days === 1 ? "" : "s"} = ${formatCurrency(computed, currency)}`}
        </p>
      </div>
    </div>
  );
}

HireTermsFields.displayName = "HireTermsFields";
