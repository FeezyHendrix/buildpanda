import type { ReactNode } from "react";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyLabel?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function ChartCard({
  title,
  subtitle,
  action,
  isLoading,
  isEmpty,
  emptyLabel = "No data available",
  children,
  className,
  contentClassName,
}: ChartCardProps) {
  return (
    <Card padding="md" className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      <div className={cn("relative h-[300px] w-full", contentClassName)}>
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
            <Spinner size="md" />
          </div>
        ) : isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-500 text-center">{emptyLabel}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}
