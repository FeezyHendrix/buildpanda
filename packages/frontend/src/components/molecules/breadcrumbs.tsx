import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/** 14px ink crumbs separated by "/", links underline on hover, each crumb ellipsised at 256px. */
function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center", className)}>
      <ol className="flex flex-wrap items-center gap-2 text-sm text-ink">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-2">
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="max-w-64 truncate hover:text-ink-hover hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn("max-w-64 truncate", isLast ? "text-ink-muted" : undefined)}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <span aria-hidden="true" className="text-ink-muted">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

Breadcrumbs.displayName = "Breadcrumbs";

export { Breadcrumbs, type BreadcrumbsProps, type BreadcrumbItem };
