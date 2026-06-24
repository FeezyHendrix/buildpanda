import { KpiCard } from "@/components/molecules/kpi-card";
import { cn } from "@/lib/utils";

export function SummaryTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <KpiCard label={label} padding="md">
      <p
        className={cn(
          "text-base font-bold tabular-nums",
          accent ? "text-[#004DE7]" : "text-gray-900",
        )}
      >
        {value}
      </p>
    </KpiCard>
  );
}
