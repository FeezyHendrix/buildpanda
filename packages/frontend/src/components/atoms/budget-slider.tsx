import { cn } from "@/lib/utils";
import { formatCurrency, formatCompactCurrency } from "@/lib/formatters";

interface BudgetSliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  currency?: string;
  className?: string;
}

function BudgetSlider({
  min = 10_000_000,
  max = 10_000_000_000,
  step = 10_000_000,
  value,
  onChange,
  currency = "NGN",
  className,
}: BudgetSliderProps) {
  const range = max - min;
  const leftPct = ((value[0] - min) / range) * 100;
  const rightPct = 100 - ((value[1] - min) / range) * 100;

  const labels = [min, max * 0.25, max * 0.5, max * 0.75, max];

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="text-xl font-semibold text-[#004DE7]">
        {formatCurrency(value[0], currency, { whole: true })} –{" "}
        {formatCurrency(value[1], currency, { whole: true })}
      </div>

      <div className="relative flex h-6 items-center">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          aria-label="Minimum budget"
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange([v, Math.max(v, value[1])]);
          }}
          className="pointer-events-none absolute w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#004DE7] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
          style={{ zIndex: value[0] > (min + max) / 2 ? 5 : 3 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[1]}
          aria-label="Maximum budget"
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange([Math.min(value[0], v), v]);
          }}
          className="pointer-events-none absolute w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#004DE7] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
          style={{ zIndex: value[1] < (min + max) / 2 ? 5 : 3 }}
        />

        <div className="relative h-1.5 w-full rounded-full bg-[#F6F6F6]">
          <div
            className="absolute h-full rounded-full bg-[#004DE7]"
            style={{ left: `${leftPct}%`, right: `${rightPct}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between text-xs text-gray-500">
        {labels.map((l) => (
          <span key={l}>{formatCompactCurrency(l, currency)}</span>
        ))}
      </div>
    </div>
  );
}

BudgetSlider.displayName = "BudgetSlider";

export { BudgetSlider, type BudgetSliderProps };
