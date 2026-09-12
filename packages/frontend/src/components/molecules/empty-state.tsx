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
  /** Icon rendered above the title. Any size class it carries is overridden. */
  icon?: ReactNode;
  /** A full illustration shown instead of the icon (first-run screens only). */
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
  page: "min-h-[360px] justify-center py-12",
  inline: "py-12",
};

/**
 * The one empty state: a quiet icon, a 16px title, one muted sentence and at
 * most one button, centred. Pages supply words and a handler, nothing else.
 */
function EmptyState({ icon, illustration, title, description, action, variant = "page", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center gap-2 text-center",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {illustration ? (
        <div className="flex items-center justify-center pb-2">{illustration}</div>
      ) : icon ? (
        <div className="flex size-8 items-center justify-center pb-2 text-ink-disabled [&>svg]:size-8 [&>svg]:text-ink-disabled">
          {icon}
        </div>
      ) : null}

      <h2 className="text-base font-medium text-ink text-balance">{title}</h2>

      {description ? <p className="text-sm text-ink-muted text-pretty">{description}</p> : null}

      {action ? (
        <div className="pt-2">
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
