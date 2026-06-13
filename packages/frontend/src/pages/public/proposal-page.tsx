import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { usePublicProposal } from "@/hooks/use-proposals";
import { proposalsApi } from "@/api/proposals";
import { formatLongDate, formatWholeCurrency as fmt } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import logo from "@/assets/images/logo.svg";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm border-b border-gray-100 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

type ResponseAction = "accept" | "decline" | "change_requested";

export default function PublicProposalPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { data, isLoading, isError } = usePublicProposal(token);

  const [responded, setResponded] = useState(false);
  const [responseAction, setResponseAction] = useState<ResponseAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ResponseAction | null>(null);

  async function handleRespond(action: ResponseAction) {
    setSubmitting(true);
    setError(null);
    try {
      await proposalsApi.respond(token, action);
      setResponseAction(action);
      setResponded(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      setConfirmAction(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FB]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F4F6FB] px-4">
        <img src={logo} alt="BuildPanda" className="h-9" />
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm max-w-sm w-full">
          <h1 className="text-lg font-semibold text-gray-900">Proposal not found</h1>
          <p className="mt-2 text-sm text-gray-500">
            This link may have expired or the proposal is no longer available.
          </p>
        </div>
      </div>
    );
  }

  const { proposal, estimate } = data;
  const currency = proposal.currency;
  const isClosed = estimate.status !== "Sent";

  const closedMessages: Record<"Accepted" | "Declined" | "Expired", { heading: string; body: string; icon: string; iconBg: string }> = {
    Accepted: {
      heading: "You've accepted this proposal",
      body: "The contractor has been notified. They'll be in touch to confirm next steps.",
      icon: "✓",
      iconBg: "bg-green-100",
    },
    Declined: {
      heading: "This proposal was declined",
      body: "The contractor has been notified. Thank you for letting them know.",
      icon: "✕",
      iconBg: "bg-red-100",
    },
    Expired: {
      heading: "This proposal has expired",
      body: "Please get in touch with the contractor for an updated quote.",
      icon: "⏱",
      iconBg: "bg-gray-100",
    },
  };

  const responseMessages: Record<ResponseAction, { heading: string; body: string }> = {
    accept: {
      heading: "You've accepted the proposal!",
      body: "The contractor has been notified. They'll be in touch to confirm next steps.",
    },
    decline: {
      heading: "Proposal declined",
      body: "The contractor has been notified. Thank you for letting them know.",
    },
    change_requested: {
      heading: "Changes requested",
      body: "The contractor has been notified and will review your request.",
    },
  };

  const showClosedState =
    isClosed && estimate.status in closedMessages && !responded;
  const closedState = showClosedState
    ? closedMessages[estimate.status as keyof typeof closedMessages]
    : null;

  if (responded || closedState) {
    const msg = responded ? responseMessages[responseAction!] : closedState!;
    const icon = responded
      ? responseAction === "accept" ? "✓" : responseAction === "decline" ? "✕" : "↩"
      : closedState!.icon;
    const iconBg = responded ? "bg-green-100" : closedState!.iconBg;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F4F6FB] px-4">
        <img src={logo} alt="BuildPanda" className="h-9" />
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm max-w-sm w-full">
          <div className="mb-4 flex justify-center">
            <span className={cn("flex h-12 w-12 items-center justify-center rounded-full text-2xl", iconBg)}>
              {icon}
            </span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">{msg.heading}</h1>
          <p className="mt-2 text-sm text-gray-500">{msg.body}</p>
          <div className="mt-5 border-t border-gray-100 pt-4 text-left">
            <p className="text-xs uppercase tracking-wide text-gray-400">Proposal</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{proposal.title}</p>
            <p className="text-xs text-gray-500">{proposal.numberLabel} · {fmt(estimate.total, currency)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">Powered by BuildPanda</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex justify-center">
          <img src={logo} alt="BuildPanda" className="h-9" />
        </div>

        {/* Proposal card */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Title bar */}
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-medium text-gray-400">{proposal.numberLabel}</p>
                <h1 className="mt-1 text-xl font-semibold text-gray-900">{proposal.title}</h1>
                <p className="mt-0.5 text-sm text-gray-500">Prepared for {proposal.clientName}</p>
              </div>
              {isClosed && (
                <span className={cn(
                  "mt-1 shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                  estimate.status === "Accepted" && "bg-green-100 text-green-700",
                  estimate.status === "Declined" && "bg-red-100 text-red-700",
                  estimate.status === "Expired" && "bg-gray-100 text-gray-500",
                )}>
                  {estimate.status}
                </span>
              )}
            </div>
          </div>

          <div className="p-6 flex flex-col gap-6">
            {/* Brief */}
            {proposal.brief && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Project brief
                </h2>
                <p className="whitespace-pre-line text-sm text-gray-700">{proposal.brief}</p>
              </div>
            )}

            {/* Line items */}
            {estimate.items.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Estimate breakdown
                </h2>
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Description</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Qty</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Rate</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimate.items.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 last:border-0">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{item.description}</p>
                            {item.groupLabel && (
                              <p className="text-xs text-gray-400">{item.groupLabel}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {item.qty} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {fmt(item.unitRate, currency)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800">
                            {fmt(item.total, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="rounded-xl bg-gray-50 p-4">
              <Row label="Subtotal" value={fmt(estimate.subtotal, currency)} />
              {estimate.contingencyPct > 0 && (
                <Row
                  label={`Contingency (${estimate.contingencyPct}%)`}
                  value={fmt(estimate.subtotal * estimate.contingencyPct / 100, currency)}
                />
              )}
              <Row
                label={`${estimate.taxLabel} (${estimate.taxPct}%)`}
                value={fmt(estimate.taxAmount, currency)}
              />
              <div className="flex justify-between gap-4 pt-3 mt-1 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-[#004DE7]">{fmt(estimate.total, currency)}</span>
              </div>
            </div>

            {/* Payment schedule */}
            {estimate.schedule.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Payment schedule
                </h2>
                <div className="flex flex-col gap-2">
                  {estimate.schedule.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{s.label}</p>
                        {s.description && <p className="text-xs text-gray-400">{s.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {fmt(estimate.total * s.percent / 100, currency)}
                        </p>
                        <p className="text-xs text-gray-400">{s.percent}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validity */}
            {proposal.validUntil && (
              <p className="text-center text-xs text-gray-400">
                This proposal is valid until {formatLongDate(proposal.validUntil)}
              </p>
            )}

            {/* Actions */}
            {!isClosed && (
              <div className="flex flex-col gap-3 pt-2">
                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">
                    {error}
                  </p>
                )}

                {confirmAction ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
                    <p className="mb-4 text-sm font-medium text-gray-900">
                      {confirmAction === "accept" && "Accept this proposal and its terms?"}
                      {confirmAction === "decline" && "Decline this proposal?"}
                      {confirmAction === "change_requested" && "Request changes to this proposal?"}
                    </p>
                    <div className="flex justify-center gap-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmAction(null)}
                        disabled={submitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleRespond(confirmAction)}
                        disabled={submitting}
                        className={cn(
                          confirmAction === "decline" && "bg-red-600 hover:bg-red-700",
                        )}
                      >
                        {submitting ? "Submitting…" : "Confirm"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() => setConfirmAction("accept")}
                    >
                      Accept proposal
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setConfirmAction("change_requested")}
                    >
                      Request changes
                    </Button>
                    <Button
                      variant="secondary"
                      className={cn("flex-1 text-red-600 hover:bg-red-50")}
                      onClick={() => setConfirmAction("decline")}
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">Powered by BuildPanda</p>
      </div>
    </div>
  );
}
