import { Spinner } from "@/components/atoms/spinner";
import { useRfiEvents } from "@/hooks/use-rfis";
import { formatShortDate } from "@/lib/formatters";
import type { RfiEvent } from "@/lib/project-types";

const EVENT_LABEL: Record<string, string> = {
  created: "Raised",
  opened: "Issued",
  ball_in_court_changed: "Ball in court reassigned",
  answered: "Answered",
  response_proposed: "Response proposed",
  reopened: "Reopened",
  closed: "Closed",
  voided: "Voided",
  distribution_added: "Copied to",
  external_response_proposed: "External response received",
  converted_to_change: "Converted to a change event",
  updated: "Edited",
};

function labelFor(type: string): string {
  return EVENT_LABEL[type] ?? type.replace(/_/g, " ");
}

/** The one or two facts worth showing from an event's free-form detail blob. */
function detailLine(event: RfiEvent): string | null {
  const detail = event.detail;
  if (!detail || typeof detail !== "object") return null;
  const record = detail as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof record["to"] === "string") parts.push(`to ${record["to"]}`);
  if (typeof record["email"] === "string") parts.push(String(record["email"]));
  if (typeof record["reason"] === "string") parts.push(String(record["reason"]));
  if (record["linked"] === true) parts.push("linked to an existing change request");
  return parts.length > 0 ? parts.join(" · ") : null;
}

interface RfiAuditTrailProps {
  projectId: string;
  rfiId: string;
}

/**
 * An RFI is a contractual record: every reassignment, answer, reopen and
 * conversion has to be visible, not just logged (finding F35).
 */
function RfiAuditTrail({ projectId, rfiId }: RfiAuditTrailProps) {
  const { data: events = [], isPending, isError } = useRfiEvents(projectId, rfiId);

  return (
    <section className="mt-6">
      <p className="text-xs font-medium uppercase text-ink-muted">History</p>
      {isPending ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : isError ? (
        <p className="mt-2 text-sm text-negative-600">Could not load the history.</p>
      ) : events.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">Nothing recorded yet.</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-2 border-l border-line-hair pl-4">
          {events.map((event) => {
            const extra = detailLine(event);
            return (
              <li key={event.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-gray-300" aria-hidden="true" />
                <span className="font-medium text-gray-900">{labelFor(event.type)}</span>
                {extra ? <span className="text-gray-600"> — {extra}</span> : null}
                <span className="block text-xs text-gray-400">
                  {event.actorLabel ?? "System"} · {formatShortDate(event.createdAt) || event.createdAt}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

RfiAuditTrail.displayName = "RfiAuditTrail";

export { RfiAuditTrail, type RfiAuditTrailProps };
