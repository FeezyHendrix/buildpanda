import { ReactNode } from "react";
import { Card, Loading, EmptyState, ErrorState } from "./ui";
import { cn } from "@/lib/utils";

export function AsOf({ timestamp }: { timestamp: string }) {
  return (
    <div className="text-xs text-gray-500 font-medium">
      As of {new Date(timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} (Africa/Lagos)
    </div>
  );
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: { from?: string; to?: string };
  onChange: (val: { from?: string; to?: string }) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-md text-sm">
      {(["7d", "30d", "90d"] as const).map((preset) => {
        const days = parseInt(preset);
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        const isActive = value.from && new Date(value.from).toDateString() === fromDate.toDateString();

        return (
          <button
            key={preset}
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - days);
              onChange({ from: d.toISOString(), to: new Date().toISOString() });
            }}
            className={cn(
              "px-3 py-1 rounded transition-colors",
              isActive ? "bg-white shadow-sm font-medium text-primary-700" : "text-gray-600 hover:text-gray-900"
            )}
          >
            {preset}
          </button>
        );
      })}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  isLoading,
  error,
  isEmpty,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  isLoading?: boolean;
  error?: Error | null | unknown;
  isEmpty?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5 flex flex-col gap-4", className)}>
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
      </div>
      <div className="flex-1 min-h-[300px] flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loading />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <ErrorState message={error instanceof Error ? error.message : "Failed to load chart data"} />
          </div>
        ) : isEmpty ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState title="No data available" hint="There is no data for the selected range." />
          </div>
        ) : (
          <div className="h-[300px] w-full">{children}</div>
        )}
      </div>
    </Card>
  );
}
