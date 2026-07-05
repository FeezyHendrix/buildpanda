import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Illustration or icon rendered above the title */
  icon?: ReactNode;
  /** Primary heading */
  title: string;
  /** Supporting copy below the title */
  description?: string;
  /** Optional action (button, link, etc.) rendered below the description */
  action?: ReactNode;
  /** Extra classes on the outer wrapper */
  className?: string;
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      {icon && <div className="flex items-center justify-center">{icon}</div>}

      <h2 className="mt-6 text-base font-semibold text-[#131B2E] text-balance">
        {title}
      </h2>

      {description && (
        <p className="mt-3 max-w-md text-[13px] text-black-300 text-pretty">
          {description}
        </p>
      )}

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

EmptyState.displayName = "EmptyState";

export { EmptyState, type EmptyStateProps };
