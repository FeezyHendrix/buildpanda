import { EmptyState } from "@/components/molecules/empty-state";
import { useProposalWorkspace } from "@/hooks/use-proposals";
import { formatActivityTimestamp } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type EventTone = "neutral" | "info" | "success" | "warning" | "danger";

const EVENT_LABELS: Record<string, { label: string; tone: EventTone }> = {
  created: { label: "Proposal created", tone: "neutral" },
  estimate_drafted: { label: "Estimate drafted", tone: "info" },
  estimate_sent: { label: "Estimate sent to client", tone: "info" },
  client_viewed: { label: "Client opened the proposal", tone: "neutral" },
  client_accepted: { label: "Client accepted the proposal", tone: "success" },
  client_declined: { label: "Client declined the proposal", tone: "danger" },
  client_change_requested: { label: "Client requested changes", tone: "warning" },
  converted: { label: "Converted to construction project", tone: "success" },
};

const EVENT_DOT: Record<EventTone, string> = {
  neutral: "bg-gray-300",
  info: "bg-blue-400",
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

interface Props {
  proposalId: string;
}

export function ActivityTab({ proposalId }: Props) {
  const { data } = useProposalWorkspace(proposalId);
  const events = data?.events ?? [];

  if (events.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Lifecycle events (created, sent, viewed, accepted…) appear here."
      />
    );
  }

  return (
    <ol className="relative ml-3 border-l-2 border-gray-100 pl-6">
      {events.map((event) => {
        const meta = EVENT_LABELS[event.type] ?? { label: event.type, tone: "neutral" as const };
        return (
          <li key={event.id} className="relative mb-5 last:mb-0">
            <span
              className={cn(
                "absolute -left-[31px] mt-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white",
                EVENT_DOT[meta.tone],
              )}
              aria-hidden
            />
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-gray-900">{meta.label}</p>
              <span className="shrink-0 text-xs text-gray-400">
                {formatActivityTimestamp(event.createdAt)}
              </span>
            </div>
            <EventMetadata metadata={event.metadata} />
          </li>
        );
      })}
    </ol>
  );
}

function EventMetadata({ metadata }: { metadata: unknown }) {
  if (!metadata || typeof metadata !== "object") return null;
  const entries = Object.entries(metadata as Record<string, unknown>).filter(([, v]) => v != null);
  if (entries.length === 0) return null;
  return (
    <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs text-gray-500">
      {entries.map(([key, value]) => (
        <FragmentLike key={key} label={key} value={String(value)} />
      ))}
    </dl>
  );
}

function FragmentLike({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-mono uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-gray-600">{value}</dd>
    </>
  );
}
