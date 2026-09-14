import { type ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  /** Optional leading icon inside the button (e.g. a plus). */
  icon?: ReactNode;
  /** Wire to the mutation's isPending when the action starts async work. */
  loading?: boolean;
}

interface EmptyStateProps {
  /** Icon rendered in the ring above the title. Any size class it carries is overridden. */
  icon?: ReactNode;
  /** A full illustration shown instead of the icon ring (first-run screens only). */
  illustration?: ReactNode;
  /** "No X yet" — no trailing full stop. */
  title: string;
  /** One sentence: what will appear here, or what to do. */
  description?: string;
  /** The single primary action. The molecule owns the button's look; pages only supply label + handler. */
  action?: EmptyStateAction;
  /**
   * `page` centres the block in the content area below the header (list pages);
   * `inline` sits compactly inside a table cell, card or panel.
   */
  variant?: "page" | "inline";
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<EmptyStateProps["variant"]>, string> = {
  page: "min-h-[360px] justify-center py-10",
  inline: "py-6",
};

/**
 * The one empty state. Pages used to hand-roll these — bordered cards, dashed
 * boxes, bare paragraphs, table rows, eleven button variants — so the look is
 * fixed here and the props are deliberately narrow.
 */
function EmptyState({ icon, illustration, title, description, action, variant = "page", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center text-center",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {illustration ? (
        <div className="flex items-center justify-center">{illustration}</div>
      ) : icon ? (
        <div className="flex size-14 items-center justify-center rounded-full bg-gray-50 text-gray-400 [&>svg]:size-6 [&>svg]:text-gray-400">
          {icon}
        </div>
      ) : null}

      <h2 className={cn("text-base font-semibold text-[#131B2E] text-balance", icon || illustration ? "mt-5" : undefined)}>
        {title}
      </h2>

      {description ? <p className="mt-2 text-[13px] text-black-300 text-pretty">{description}</p> : null}

      {action ? (
        <div className="mt-6">
          <Button variant="primary" size="md" onClick={action.onClick} loading={action.loading}>
            {action.icon}
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

EmptyState.displayName = "EmptyState";

export { EmptyState, type EmptyStateProps, type EmptyStateAction };
