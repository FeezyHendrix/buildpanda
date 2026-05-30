import { type ReactNode } from "react";
import { Card, type CardPadding } from "@/components/atoms/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  children: ReactNode;
  padding?: CardPadding;
  className?: string;
}

function KpiCard({
  label,
  children,
  padding = "md",
  className,
}: KpiCardProps) {
  return (
    <Card padding={padding} className={cn("flex flex-col", className)}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="mt-3 flex-1">{children}</div>
    </Card>
  );
}

KpiCard.displayName = "KpiCard";

export { KpiCard, type KpiCardProps };
