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
      <span className="text-xs text-ink-muted">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", accent ? "text-primary-500" : "text-ink")}>
        {value}
      </span>
    </div>
  );
}

PoMetric.displayName = "PoMetric";
