import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  bordered?: boolean;
  interactive?: boolean;
}

const paddingStyles: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      padding = "md",
      bordered = true,
      interactive = false,
      className,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl bg-white",
        bordered && "border border-[#EDEDED]",
        interactive &&
          "cursor-pointer transition-shadow hover:shadow-sm focus-visible:ring-2 focus-visible:ring-gray-900/10",
        paddingStyles[padding],
        className,
      )}
      {...props}
    />
  ),
);

Card.displayName = "Card";

export { Card, type CardProps, type CardPadding };
