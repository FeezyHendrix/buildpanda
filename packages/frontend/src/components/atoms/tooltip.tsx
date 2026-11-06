import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: ReactNode;
  /** The element that opens it on hover or focus. It must accept a ref and DOM props. */
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  /** Which edge of the trigger the bubble lines up with; the arrow follows the trigger either way. */
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * The one tooltip: a brand-blue bubble with white text and a small arrow
 * pointing at what it explains. Every hint in the app renders through this so
 * they read as one product; chart hover cards and the product tour are
 * different things and keep their own surfaces.
 */
function Tooltip({ content, children, side = "bottom", align = "center", className }: TooltipProps) {
  return (
    <BaseTooltip.Provider delay={150} closeDelay={80}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger render={children} />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} align={align} sideOffset={10} collisionPadding={12} className="z-[90]">
            <BaseTooltip.Popup
              className={cn(
                "w-max max-w-[245px] rounded-none bg-primary px-3.5 py-2.5 text-[13px] font-normal leading-5 text-white shadow-lg",
                "transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
                className,
              )}
            >
              <BaseTooltip.Arrow
                className={cn(
                  "size-2.5 rotate-45 rounded-none bg-primary",
                  "data-[side=bottom]:-top-[5px] data-[side=top]:-bottom-[5px]",
                  "data-[side=left]:-right-[5px] data-[side=right]:-left-[5px]",
                )}
              />
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}

Tooltip.displayName = "Tooltip";

/** The blue ⓘ that explains a label or title; hover or focus it to read the hint. */
function InfoTooltip({
  text,
  align = "end",
  side = "bottom",
  className,
}: {
  text: ReactNode;
  align?: TooltipProps["align"];
  side?: TooltipProps["side"];
  className?: string;
}) {
  return (
    <Tooltip content={text} align={align} side={side}>
      <button
        type="button"
        aria-label="More information"
        className={cn("inline-flex shrink-0 cursor-help rounded-full text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/30", className)}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </Tooltip>
  );
}

InfoTooltip.displayName = "InfoTooltip";

export { Tooltip, InfoTooltip, type TooltipProps };
