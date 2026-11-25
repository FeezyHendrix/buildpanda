import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import type { ReactNode } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { useInvoiceHistory, type InvoiceEvent, type InvoiceEventType } from "@/hooks/use-invoices";
import { errorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";

/**
 * Who moved the invoice, when and why: the audit trail as a vertical timeline.
 * A query is a formal dispute and a void reverses an accounting record, so both
 * stand on the file with an actor and a reason rather than as a silent status edit.
 */

type Tone = "done" | "warn" | "bad";

const EVENT_META: Record<InvoiceEventType, { label: string; tone: Tone }> = {
  created: { label: "Raised", tone: "done" },
  sent: { label: "Sent", tone: "done" },
  queried: { label: "Queried", tone: "warn" },
  approved: { label: "Approved", tone: "done" },
  voided: { label: "Voided", tone: "bad" },
  payment_recorded: { label: "Payment recorded", tone: "done" },
  payment_removed: { label: "Payment removed", tone: "bad" },
};

const TONE_ICON: Record<Tone, ReactNode> = {
  done: <CircleCheck className="size-[24px] text-[#00A63E]" strokeWidth={1.5} aria-hidden />,
  warn: <CircleAlert className="size-[24px] text-[#E58A00]" strokeWidth={1.5} aria-hidden />,
  bad: <CircleX className="size-[24px] text-[#E7000B]" strokeWidth={1.5} aria-hidden />,
};

/** "06 July 2026 · 10:24 AM" */
function formatStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
  return `${day} · ${time}`;
}

function Step({ event, currency, last }: { event: InvoiceEvent; currency: string; last: boolean }) {
  const meta = EVENT_META[event.type] ?? { label: event.type, tone: "done" as Tone };
  return (
    <li className="relative flex gap-[14px] pb-[32px] last:pb-0">
      {last ? null : <span aria-hidden className="absolute left-[11px] top-[28px] h-[calc(100%-28px)] w-px bg-[#D9D9D9]" />}
      <span className="relative z-10 flex size-[24px] shrink-0 items-center justify-center bg-white">{TONE_ICON[meta.tone]}</span>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-[16px]">
        <div className="min-w-0">
          <p className="text-caption-m font-medium leading-[20px] text-[#1E1E1E]">
            {meta.label}
            {event.amount !== null ? ` · ${formatCurrency(event.amount, currency)}` : ""}
          </p>
          <p className="text-caption-m leading-[16px] text-[#737373]">by {event.actor.name}</p>
          {event.reason ? <p className="mt-[4px] text-caption-m text-[#1E1E1E] text-pretty">{event.reason}</p> : null}
        </div>
        <p className="shrink-0 pt-[8px] text-caption-m text-[#737373]">{formatStamp(event.createdAt)}</p>
      </div>
    </li>
  );
}

Step.displayName = "Step";

export function InvoiceTimeline({ projectId, invoiceId, currency }: { projectId: string; invoiceId: string; currency: string }) {
  const { data: events = [], isPending, isError, error } = useInvoiceHistory(projectId, invoiceId);

  if (isPending) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="md" />
      </div>
    );
  }
  if (isError) return <p className="text-caption-l text-[#E7000B]">{errorMessage(error, "Could not load the approval timeline.")}</p>;
  if (events.length === 0) return <p className="text-caption-l text-[#737373]">Nothing recorded against this invoice yet.</p>;

  return (
    <ol>
      {events.map((event, index) => (
        <Step key={event.id} event={event} currency={currency} last={index === events.length - 1} />
      ))}
    </ol>
  );
}

InvoiceTimeline.displayName = "InvoiceTimeline";
