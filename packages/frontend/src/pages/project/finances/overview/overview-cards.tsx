import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The overview's card frame: square corners, a hairline border and a 51px title
 * bar holding the title, an optional control slot and a "View More ↗" link to the
 * page that owns the record. Overview cards explain themselves with a title, not
 * a paragraph; the owning page carries the prose. Inside a card, figures are
 * rows in a list, never a grid of tiles.
 */

/** The blue "Label ↗" in a card's title bar. */
export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-[8px] text-caption-l font-semibold text-[#004DE7] hover:underline">
      {children}
      <ArrowUpRight className="size-[18px]" strokeWidth={1.5} aria-hidden />
    </Link>
  );
}

CardLink.displayName = "CardLink";

interface OverviewCardProps {
  title: string;
  to?: string;
  linkLabel?: string;
  /** Right-hand slot beside the link (a badge, a small control). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Padding for the body; the default suits a card of rows. */
  bodyClassName?: string;
}

export function OverviewCard({ title, to, linkLabel = "View More", actions, children, className, bodyClassName }: OverviewCardProps) {
  return (
    <section className={cn("flex min-w-0 flex-col border border-[#EEEEEE] bg-white", className)}>
      <header className="flex h-[51px] shrink-0 items-center justify-between gap-3 border-b border-[#EEEEEE] px-[24px]">
        <h3 className="truncate text-caption-l font-medium text-[#1E1E1E]">{title}</h3>
        <div className="flex items-center gap-[24px]">
          {actions}
          {to ? <CardLink to={to}>{linkLabel}</CardLink> : null}
        </div>
      </header>
      <div className={cn("flex-1 px-[24px] pb-[8px] pt-[8px]", bodyClassName)}>{children}</div>
    </section>
  );
}

OverviewCard.displayName = "OverviewCard";

/** Muted one-liner for a card with nothing to show yet. */
export function OverviewEmpty({ children }: { children: string }) {
  return <p className="py-[16px] text-caption-l text-[#737373]">{children}</p>;
}

OverviewEmpty.displayName = "OverviewEmpty";

/** Rows separated by hairlines. */
export function OverviewList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-[#EEEEEE]", className)}>{children}</ul>;
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
  /** A taller row, for a label and figure that each carry a second line. */
  tall?: boolean;
  /** Runs `sub` under the label and the figure alike, for a long explanatory line. */
  wideSub?: boolean;
}

export function OverviewRow({ label, sub, value, helper, marker, to, tall = false, wideSub = false }: OverviewRowProps) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="flex items-center gap-[8px] text-caption-l text-[#1E1E1E]">
          {marker ? <span aria-hidden="true" className="flex shrink-0 items-center">{marker}</span> : null}
          <span className="truncate">{label}</span>
        </p>
        {sub && !wideSub ? <p className={cn("text-caption-m text-[#737373]", marker && "pl-[20px]")}>{sub}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-caption-l tabular-nums text-[#1E1E1E]">{value}</p>
        {helper ? <p className="max-w-[16rem] text-caption-m text-[#737373]">{helper}</p> : null}
      </div>
    </>
  );
  const rowClass = cn("flex items-center justify-between gap-4 py-[10px]", tall ? "min-h-[72px]" : "min-h-[60px]");
  const wide = sub && wideSub;
  return (
    <li>
      {to ? (
        <Link to={to} className={cn(rowClass, "transition-colors hover:bg-[#FAFAFA]")}>
          {body}
        </Link>
      ) : wide ? (
        <div className="py-[12px]">
          <div className="flex items-center justify-between gap-4">{body}</div>
          <p className="text-caption-m text-[#737373]">{sub}</p>
        </div>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

OverviewRow.displayName = "OverviewRow";
