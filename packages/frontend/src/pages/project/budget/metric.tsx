import { cn } from "@/lib/utils";

export function Metric({
  label,
  value,
  secondaryValue,
  projectedValue,
  valueClassName,
}: {
  label: string;
  value: string;
  secondaryValue?: string;
  projectedValue?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <span className={cn("text-sm font-semibold text-gray-900 tabular-nums", valueClassName)}>
        {value}
      </span>
      {secondaryValue && <span className="text-xs text-gray-400 tabular-nums">Manual: {secondaryValue}</span>}
      {projectedValue && <span className="text-xs text-gray-400 tabular-nums">Projected: {projectedValue}</span>}
    </div>
  );
}
