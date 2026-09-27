import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";
import { useInvoiceHistory, type InvoiceEventType } from "@/hooks/use-invoices";
import { errorMessage } from "@/lib/api-error";
import { formatCurrency, formatShortDate } from "@/lib/formatters";

/**
 * The audit trail on a certificate: who moved it, when, and why. A client
 * query is a formal dispute and a void reverses an accounting record — both
 * belong on the file with an actor and a reason, not as a status someone
 * silently picked from a select.
 */

const EVENT_META: Record<InvoiceEventType, { label: string; tone: BadgeTone }> = {
  created: { label: "Raised", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  queried: { label: "Queried", tone: "warning" },
  approved: { label: "Certified", tone: "success" },
  voided: { label: "Voided", tone: "danger" },
  payment_recorded: { label: "Payment recorded", tone: "success" },
  payment_removed: { label: "Payment removed", tone: "danger" },
};

interface InvoiceHistoryPanelProps {
  projectId: string;
  invoiceId: string;
  currency: string;
}

export function InvoiceHistoryPanel({ projectId, invoiceId, currency }: InvoiceHistoryPanelProps) {
  const { data: events = [], isPending, isError, error } = useInvoiceHistory(projectId, invoiceId);

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="rounded-lg bg-surface-alt p-4 text-sm text-negative-600">
        {errorMessage(error, "Could not load the certificate history.")}
      </p>
    );
  }

  if (events.length === 0) {
    return (
      <p className="rounded-lg bg-surface-alt p-4 text-sm text-ink-muted">
        Nothing recorded against this certificate yet.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => {
        const meta = EVENT_META[event.type] ?? { label: event.type, tone: "neutral" as BadgeTone };
        return (
          <li key={event.id} className="rounded-lg bg-surface-alt p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={meta.tone} size="sm" dot>
                  {meta.label}
                </Badge>
                {event.fromStatus && event.toStatus ? (
                  <span className="text-xs text-ink-muted">
                    {event.fromStatus} → {event.toStatus}
                  </span>
                ) : null}
                {event.amount !== null ? (
                  <span className="text-xs font-medium tabular-nums text-ink">
                    {formatCurrency(event.amount, currency)}
                  </span>
                ) : null}
              </div>
              <span className="text-xs text-ink-muted">
                {formatShortDate(event.createdAt) || event.createdAt}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-ink">{event.actor.name}</p>
            {event.reason ? (
              <p className="mt-1 text-sm leading-6 text-gray-700">{event.reason}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

InvoiceHistoryPanel.displayName = "InvoiceHistoryPanel";
