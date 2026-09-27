import { KpiCard } from "@/components/molecules/kpi-card";
import type { ChangeRequestSummary } from "@/hooks/use-change-requests";
import type { ChangeRequest } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { CHANGE_ORDER_COUNT_CARDS, countsFromList } from "../finances/overview/change-orders-card";

/**
 * Draft · Submitted · Approved · Executed — how many change orders sit at
 * each step. The summary endpoint is the source; while it has not answered
 * the counts are read off the loaded list so the strip never shows nothing.
 */

interface ChangeOrderSummaryStripProps {
  summary: ChangeRequestSummary | undefined;
  items: ChangeRequest[];
  className?: string;
}

export function ChangeOrderSummaryStrip({ summary, items, className }: ChangeOrderSummaryStripProps) {
  const counts = summary ?? countsFromList(items);
  return (
    <section aria-label="Change orders by status" className={cn("grid gap-4 grid-cols-2 lg:grid-cols-4", className)}>
      {CHANGE_ORDER_COUNT_CARDS.map((card) => (
        <KpiCard
          key={card.key}
          label={card.label}
          value={
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="text-base text-ink-muted">
                {card.marker}
              </span>
              {counts[card.key]}
            </span>
          }
        />
      ))}
    </section>
  );
}

ChangeOrderSummaryStrip.displayName = "ChangeOrderSummaryStrip";
