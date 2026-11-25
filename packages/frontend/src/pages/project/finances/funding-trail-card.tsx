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

/** A ring tinted by the kind of event, so a deposit and a release read apart at a glance. */
function EventIcon({ type }: { type: FinanceEventType }) {
  const styles = EVENT_STYLES[type];
  return (
    <span aria-hidden="true" className={cn("flex size-[24px] shrink-0 items-center justify-center rounded-full", styles.bg)}>
      <span className={cn("size-[8px] rounded-full", styles.dot)} />
    </span>
  );
}

/**
 * The log of every funding action on the project, newest first: what was done,
 * by whom, how much and when. It is an audit trail, so nothing here can be
 * edited, only read.
 */
export function FundingTrailCard({ projectId, currency }: FundingTrailCardProps) {
  const { data: events, isPending } = useFinanceEvents(projectId);

  return (
    <section aria-label="Funding trail" className="flex min-w-0 flex-col border border-[#EEEEEE] bg-white">
      <header className="px-[24px] pb-[8px] pt-[14px]">
        <h3 className="text-caption-l font-medium text-[#1E1E1E]">Funding Trail</h3>
        <p className="text-caption-m text-[#737373]">A log of every recorded funding action on this project.</p>
      </header>

      {isPending ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner size="md" />
        </div>
      ) : !events || events.length === 0 ? (
        <p className="flex h-32 items-center justify-center text-caption-l text-[#737373]">No funding activity logged yet.</p>
      ) : (
        <ul className="divide-y divide-[#EEEEEE] px-[24px] pb-[8px]">
          {events.map((event) => (
            <li key={event.id} className="flex min-h-[72px] items-center gap-[16px] py-[10px]">
              <EventIcon type={event.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-caption-l text-[#1E1E1E]">{event.summary}</p>
                <p className="text-caption-m text-[#737373]">by {event.actor.name}</p>
              </div>
              <div className="shrink-0 text-right">
                {event.amount !== null ? (
                  <p className="text-caption-l tabular-nums text-[#1E1E1E]">{formatCurrency(event.amount, currency)}</p>
                ) : null}
                <p className="text-caption-m text-[#737373]">{formatShortDate(event.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

FundingTrailCard.displayName = "FundingTrailCard";
