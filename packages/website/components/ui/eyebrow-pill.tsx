import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** The small rounded label above a headline. Fill follows the section's theme. */
export function EyebrowPill({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "inline-flex min-h-7 items-center rounded-full bg-(--surface-pill) px-3 text-[0.8125rem] font-medium",
        className,
      )}
      {...props}
    />
  );
}
