import { Card } from "@/components/atoms/card";
import { useFinanceEvents } from "@/hooks/use-finances";
import { formatCurrency, formatShortDate } from "@/lib/formatters";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";
import type { FinanceEventType } from "@/lib/project-types";

export interface FundingTrailCardProps {
  projectId: string;
  currency: string;
}

const EVENT_STYLES: Record<FinanceEventType, { dot: string; bg: string }> = {
  deposit: { dot: "bg-success-500", bg: "bg-success-50" },
  milestone_released: { dot: "bg-primary-500", bg: "bg-primary-50" },
  milestone_created: { dot: "bg-neutral-500", bg: "bg-neutral-50" },
  milestone_updated: { dot: "bg-neutral-500", bg: "bg-neutral-50" },
  milestone_deleted: { dot: "bg-negative-500", bg: "bg-negative-50" },
  dispute_raised: { dot: "bg-warning-500", bg: "bg-warning-50" },
  cash_flow_entry: { dot: "bg-accent-500", bg: "bg-accent-50" },
};

function EventIcon({ type }: { type: FinanceEventType }) {
  const styles = EVENT_STYLES[type];
  return (
    <div
      className={cn(
        "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        styles.bg,
      )}
    >
      <div className={cn("h-2.5 w-2.5 rounded-full", styles.dot)} />
    </div>
  );
}

export function FundingTrailCard({
  projectId,
  currency,
}: FundingTrailCardProps) {
  const { data: events, isPending } = useFinanceEvents(projectId);

  return (
    <Card className="p-6" padding="none">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-ink">Funding Trail</h3>
        <p className="mt-1 text-sm text-ink-muted">
          A log of every recorded funding action on this project.
        </p>
      </div>

      <div className="relative">
        {isPending ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : !events || events.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-ink-muted">
            No funding activity logged yet.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-0 left-4 top-0 w-px bg-line-hair" />

            <div className="space-y-6">
              {events.map((event) => (
                <div key={event.id} className="relative flex items-start gap-4">
                  <EventIcon type={event.type} />
                  <div className="flex-1 pt-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {event.summary}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          by {event.actor.name}
                        </p>
                      </div>
                      <div className="flex flex-col sm:items-end">
                        {event.amount !== null && (
                          <p className="text-sm font-semibold text-ink">
                            {formatCurrency(event.amount, currency)}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {formatShortDate(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

FundingTrailCard.displayName = "FundingTrailCard";
