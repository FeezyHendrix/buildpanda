import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/atoms/card";

/** The overview's card frame: a titled section with a "View more" link to the page that owns the record. */

interface OverviewCardProps {
  title: string;
  description: string;
  to: string;
  linkLabel?: string;
  children: ReactNode;
  className?: string;
}

export function OverviewCard({ title, description, to, linkLabel = "View more", children, className }: OverviewCardProps) {
  return (
    <Card padding="lg" className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-muted">{title}</h3>
          <p className="mt-1 text-xs text-ink-muted">{description}</p>
        </div>
        <Link to={to} className="text-xs font-semibold text-primary-500 hover:underline">
          {linkLabel} ›
        </Link>
      </div>
      {children}
    </Card>
  );
}

OverviewCard.displayName = "OverviewCard";

/** Muted one-liner for a card with nothing to show yet. */
export function OverviewEmpty({ children }: { children: string }) {
  return <p className="rounded-lg bg-surface-alt px-4 py-3 text-sm text-ink-muted">{children}</p>;
}

OverviewEmpty.displayName = "OverviewEmpty";
