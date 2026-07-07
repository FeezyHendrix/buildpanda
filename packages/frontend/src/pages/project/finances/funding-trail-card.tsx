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
  deposit: { dot: "bg-green-500", bg: "bg-green-100" },
  milestone_released: { dot: "bg-blue-500", bg: "bg-blue-100" },
  milestone_created: { dot: "bg-gray-400", bg: "bg-gray-100" },
  milestone_updated: { dot: "bg-gray-400", bg: "bg-gray-100" },
  milestone_deleted: { dot: "bg-red-500", bg: "bg-red-100" },
  dispute_raised: { dot: "bg-amber-500", bg: "bg-amber-100" },
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
    <Card className="mt-6 p-6" padding="none">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Funding Trail</h3>
        <p className="mt-1 text-sm text-gray-500">
          A log of every recorded funding action on this project.
        </p>
      </div>

      <div className="relative">
        {isPending ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : !events || events.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-500">
            No funding activity logged yet.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-0 left-4 top-0 w-px bg-[#EDEDED]" />

            <div className="space-y-6">
              {events.map((event) => (
                <div key={event.id} className="relative flex items-start gap-4">
                  <EventIcon type={event.type} />
                  <div className="flex-1 pt-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {event.summary}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          by {event.actor.name}
                        </p>
                      </div>
                      <div className="flex flex-col sm:items-end">
                        {event.amount !== null && (
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(event.amount, currency)}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-400">
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
