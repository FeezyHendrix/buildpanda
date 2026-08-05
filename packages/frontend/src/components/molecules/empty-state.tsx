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

      <div className="flex flex-col -mt-10">
        <h5 className="mt-6 text-h5 font-semibold text-grey-800">
          {title}
        </h5>

        {description && (
          <p className="mt-3 max-w-lg text-caption-l text-grey-450">
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-6 w-full">{action}</div>}
    </div>
  );
}

EmptyState.displayName = "EmptyState";

export { EmptyState, type EmptyStateProps };
