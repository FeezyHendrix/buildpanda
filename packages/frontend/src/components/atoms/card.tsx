import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  bordered?: boolean;
  interactive?: boolean;
  /** Drop the hairline shadow (nested cards, tiles inside a drawer). */
  flat?: boolean;
}

const paddingStyles: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

/** White, 8px corners, hairline border and an almost invisible shadow — the borders do the work. */
const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      padding = "md",
      bordered = true,
      interactive = false,
      flat = false,
      className,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg bg-white",
        bordered && "border border-line-hair",
        !flat && "shadow-card",
        interactive &&
          "cursor-pointer transition-colors hover:bg-surface-alt focus-visible:shadow-focus",
        paddingStyles[padding],
        className,
      )}
      {...props}
    />
  ),
);

Card.displayName = "Card";

export { Card, type CardProps, type CardPadding };
