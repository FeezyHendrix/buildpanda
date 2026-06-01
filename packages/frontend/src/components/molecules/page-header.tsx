import { type ReactNode } from "react";
import { RouteBreadcrumbs } from "@/components/molecules/breadcrumbs";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  badges?: ReactNode;
  className?: string;
}

function PageHeader({
  title,
  description,
  actions,
  badges,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <RouteBreadcrumbs />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-bold leading-tight text-gray-900 text-balance">
              {title}
            </h1>
            {badges}
          </div>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-gray-500 text-pretty">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

PageHeader.displayName = "PageHeader";

export { PageHeader, type PageHeaderProps };
