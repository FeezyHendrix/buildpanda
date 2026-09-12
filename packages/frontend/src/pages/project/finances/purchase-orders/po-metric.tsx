import { cn } from "@/lib/utils";

export function PoMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent ? "text-[#004DE7]" : "text-gray-900")}>
        {value}
      </span>
    </div>
  );
}

PoMetric.displayName = "PoMetric";
