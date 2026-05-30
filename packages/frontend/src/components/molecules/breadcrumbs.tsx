import { Link } from "react-router-dom";
import { ChevronRightIcon } from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="flex items-center gap-1.5">
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="text-gray-500 hover:text-gray-900 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "font-semibold text-gray-900"
                      : "text-gray-500"
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <ChevronRightIcon className="size-3 text-gray-300" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

Breadcrumbs.displayName = "Breadcrumbs";

export { Breadcrumbs, type BreadcrumbsProps, type BreadcrumbItem };
