import { type ReactNode } from "react";
import { useAppBarTitle } from "@/contexts/app-bar-title-context";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  badges?: ReactNode;
  className?: string;
}

/**
 * Inside the project shell the title lives in the 64px app bar (Ernest), so
 * this renders only the page's toolbar row: optional description on the left,
 * actions on the right. Outside a shell with an app bar it also draws the title.
 */
function PageHeader({
  title,
  description,
  actions,
  badges,
  className,
}: PageHeaderProps) {
  const titleInAppBar = useAppBarTitle(title);
  const hasLeft = !titleInAppBar || Boolean(description) || Boolean(badges);
  if (!hasLeft && !actions) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      {hasLeft ? (
        <div className="min-w-0 flex-1">
          {titleInAppBar ? null : (
            <h1 className="text-2xl font-medium text-ink text-balance">{title}</h1>
          )}
          {description && (
            <p className={cn("max-w-2xl text-sm text-ink-muted text-pretty", !titleInAppBar && "mt-1")}>
              {description}
            </p>
          )}
          {badges ? <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div> : null}
        </div>
      ) : (
        <span />
      )}
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

PageHeader.displayName = "PageHeader";

export { PageHeader, type PageHeaderProps };
