import { type ReactNode } from "react";
import { CreateButton } from "@/components/molecules/create-button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  /** Wire to the mutation's isPending when the action starts async work. */
  loading?: boolean;
}

interface EmptyStateProps {
  /** Icon rendered in the tile above the title. Any size class it carries is overridden. */
  icon?: ReactNode;
  /** A full illustration shown instead of the icon tile (first-run screens only). */
  illustration?: ReactNode;
  /** "No X yet" — no trailing full stop. */
  title: string;
  /** One sentence: what will appear here, or what to do. */
  description?: string;
  /** The single primary action, always a create action: the molecule renders it as the plus button. */
  action?: EmptyStateAction;
  /**
   * `page` centres the block in the content area below the header (list pages)
   * over a faded grid; `inline` sits compactly inside a table cell, card or panel.
   */
  variant?: "page" | "inline";
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<EmptyStateProps["variant"]>, string> = {
  page: "min-h-[360px] justify-center py-10",
  inline: "py-6",
};

/** The faded grid behind a page-level empty state: hairlines that dissolve away from the centre. */
const GRID_BACKDROP =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-line)_1px,transparent_1px)] bg-[size:32px_32px] bg-center [mask-image:radial-gradient(ellipse_55%_60%_at_center,black_0%,transparent_100%)]";

/**
 * The one empty state. Pages used to hand-roll these — bordered cards, dashed
 * boxes, bare paragraphs, table rows, eleven button variants — so the look is
 * fixed here and the props are deliberately narrow: a small icon tile, a short
 * title, one line of help and, when there is something to create, the plus
 * button every page uses.
 */
function EmptyState({ icon, illustration, title, description, action, variant = "page", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative mx-auto flex w-full max-w-md flex-col items-center text-center",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {variant === "page" ? <div aria-hidden="true" className={GRID_BACKDROP} /> : null}

      <div className="relative flex flex-col items-center">
        {illustration ? (
          <div className="flex items-center justify-center">{illustration}</div>
        ) : icon ? (
          <div className="flex size-9 items-center justify-center rounded-lg border border-line bg-white text-ink shadow-sm [&>svg]:size-4 [&>svg]:text-ink">
            {icon}
          </div>
        ) : null}

        <h2 className={cn("text-sm font-semibold text-ink text-balance", icon || illustration ? "mt-4" : undefined)}>
          {title}
        </h2>

        {description ? <p className="mt-1 max-w-xs text-xs text-ink-muted text-pretty">{description}</p> : null}

        {action ? (
          <div className="mt-4">
            <CreateButton variant="secondary" size="sm" onClick={action.onClick} loading={action.loading}>
              {action.label}
            </CreateButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

EmptyState.displayName = "EmptyState";

export { EmptyState, type EmptyStateProps, type EmptyStateAction };
