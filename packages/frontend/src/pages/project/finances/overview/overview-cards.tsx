import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";
import { cn } from "@/lib/utils";

/**
 * The overview's card frame: a one-line title, an optional control slot, and a
 * "View more" link to the page that owns the record. Overview cards explain
 * themselves with a title, not a paragraph; the owning page carries the prose.
 * Inside a card, figures are rows in a list, never a grid of tiles.
 */

interface OverviewCardProps {
  title: string;
  to?: string;
  linkLabel?: string;
  /** Right-hand slot beside the link (a badge, a small control). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function OverviewCard({ title, to, linkLabel = "View more", actions, children, className }: OverviewCardProps) {
  return (
    <Card padding="md" className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-black-300">{title}</h3>
        <div className="flex items-center gap-3">
          {actions}
          {to ? (
            <Link to={to} className="text-xs font-semibold text-primary-500 hover:underline">
              {linkLabel} ›
            </Link>
          ) : null}
        </div>
      </div>
      {children}
    </Card>
  );
}

OverviewCard.displayName = "OverviewCard";

/** Muted one-liner for a card with nothing to show yet. */
export function OverviewEmpty({ children }: { children: string }) {
  return <p className="py-3 text-[13px] text-ink-muted">{children}</p>;
}

OverviewEmpty.displayName = "OverviewEmpty";

/** Rows separated by hairlines. */
export function OverviewList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-line-hair", className)}>{children}</ul>;
}

OverviewList.displayName = "OverviewList";

interface OverviewRowProps {
  /** What the row is about; read on the left. */
  label: ReactNode;
  /** A second muted line under the label. */
  sub?: ReactNode;
  /** The figure or badge, read on the right. */
  value: ReactNode;
  /** A second muted line under the value. */
  helper?: ReactNode;
  /** A small glyph before the label (a status marker). */
  marker?: ReactNode;
  /** Makes the whole row a link. */
  to?: string;
}

export function OverviewRow({ label, sub, value, helper, marker, to }: OverviewRowProps) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[13px] text-ink">
          {marker ? <span aria-hidden="true" className="text-ink-muted">{marker}</span> : null}
          <span className="truncate">{label}</span>
        </p>
        {sub ? <p className="mt-0.5 truncate text-xs text-ink-muted">{sub}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[13px] font-medium tabular-nums text-ink">{value}</p>
        {helper ? <p className="mt-0.5 max-w-[14rem] text-xs text-ink-muted">{helper}</p> : null}
      </div>
    </>
  );
  const rowClass = "flex items-start justify-between gap-4 py-2.5";
  return (
    <li>
      {to ? (
        <Link to={to} className={cn(rowClass, "-mx-2 rounded-md px-2 transition-colors hover:bg-surface-alt")}>
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

OverviewRow.displayName = "OverviewRow";
