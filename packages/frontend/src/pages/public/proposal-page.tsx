import { useState } from "react";
import { useParams } from "react-router-dom";
import { Spinner } from "@/components/atoms/spinner";
import { usePublicProposal } from "@/hooks/use-proposals";
import { proposalsApi, type ClientResponse } from "@/api/proposals";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatLongDate, formatWholeCurrency as fmt } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import logo from "@/assets/images/logo.svg";
import {
  BuyingListSection,
  CompanyBlock,
  PriceSection,
  ProseSections,
  ScopeSection,
  StagesSection,
} from "./proposal-page/offer-sections";
import { RespondPanel } from "./proposal-page/respond-panel";

interface Outcome {
  heading: string;
  body: string;
  icon: string;
  iconBg: string;
}

const CLOSED: Partial<Record<string, Outcome>> = {
  Accepted: { heading: "You've accepted this proposal", body: "The contractor has been notified and will be in touch to confirm next steps.", icon: "✓", iconBg: "bg-success-100" },
  Declined: { heading: "This proposal was declined", body: "The contractor has been notified. Thank you for letting them know.", icon: "✕", iconBg: "bg-red-100" },
  Expired: { heading: "This proposal has expired", body: "Please get in touch with the contractor for an updated quote.", icon: "⏱", iconBg: "bg-gray-100" },
};

const RESPONDED: Record<ClientResponse, Outcome> = {
  accept: { heading: "Accepted and signed", body: "The contractor has your acceptance with the date and time. They'll be in touch to confirm the start.", icon: "✓", iconBg: "bg-success-100" },
  decline: { heading: "Proposal declined", body: "The contractor has been notified. Thank you for letting them know.", icon: "✕", iconBg: "bg-red-100" },
  change_requested: { heading: "Changes requested", body: "The contractor has your message and will send a revised proposal.", icon: "↩", iconBg: "bg-amber-100" },
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F4F6FB] px-4">
      <img src={logo} alt="BuildPanda" className="h-9" />
      {children}
      <p className="text-xs text-gray-400">Powered by BuildPanda</p>
    </div>
  );
}
Frame.displayName = "Frame";

function OutcomeCard({ outcome, title, meta }: { outcome: Outcome; title: string; meta: string }) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <span className={cn("mx-auto mb-4 flex size-12 items-center justify-center rounded-full text-2xl", outcome.iconBg)}>{outcome.icon}</span>
      <h1 className="text-lg font-semibold text-gray-900">{outcome.heading}</h1>
      <p className="mt-2 text-sm text-gray-500">{outcome.body}</p>
      <div className="mt-5 border-t border-gray-100 pt-4 text-left">
        <p className="text-xs uppercase tracking-wide text-gray-400">Proposal</p>
        <p className="mt-1 text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{meta}</p>
      </div>
    </div>
  );
}
OutcomeCard.displayName = "OutcomeCard";

// The offer as the client reads it: who is offering, what is in scope, the
// price at the detail level the contractor chose, the stages, the prose, and
// one place to respond. Drawings and the programme stay internal.
export default function PublicProposalPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { data, isLoading, isError } = usePublicProposal(token);
  const [responded, setResponded] = useState<ClientResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(body: { action: ClientResponse; name?: string; message?: string }) {
    setSubmitting(true);
    setError(null);
    try {
      await proposalsApi.respond(token, body);
      setResponded(body.action);
    } catch (err) {
      setError(getApiErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
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
      <Frame>
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Proposal not found</h1>
          <p className="mt-2 text-sm text-gray-500">This link may have expired or the proposal is no longer available.</p>
        </div>
      </Frame>
    );
  }

  const { proposal, estimate, company, sections, buyingList } = data;
  const currency = proposal.currency;
  const isOpen = estimate.status === "Sent";
  const meta = `${proposal.numberLabel} · ${fmt(estimate.total, currency)}`;

  if (responded) {
    return (
      <Frame>
        <OutcomeCard outcome={RESPONDED[responded]} title={proposal.title} meta={meta} />
      </Frame>
    );
  }
  const closed = !isOpen ? CLOSED[estimate.status] : undefined;
  if (closed) {
    return (
      <Frame>
        <OutcomeCard outcome={closed} title={proposal.title} meta={meta} />
      </Frame>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6FB] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex justify-center">
          <img src={logo} alt="BuildPanda" className="h-9" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 bg-gray-50 px-6 py-5">
            <CompanyBlock company={company} />
            <p className="mt-5 font-mono text-xs font-medium text-gray-400">
              {proposal.numberLabel} · {estimate.revisionLabel}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">{proposal.title}</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Prepared for {proposal.clientName}
              {proposal.location ? ` · ${proposal.location}` : ""}
            </p>
          </div>

          <div className="flex flex-col gap-7 p-6">
            <ScopeSection sections={sections} brief={proposal.brief} />
            <PriceSection estimate={estimate} currency={currency} />
            <ProseSections sections={sections} kinds={["exclusions", "assumptions", "provisional_sums"]} />
            <BuyingListSection lines={buyingList} />
            <StagesSection estimate={estimate} currency={currency} />
            <ProseSections sections={sections} kinds={["warranties", "terms"]} />

            {proposal.validUntil ? (
              <p className="text-center text-xs text-gray-400">This proposal is valid until {formatLongDate(proposal.validUntil)}</p>
            ) : null}

            <div className="pt-2">
              <RespondPanel clientName={proposal.clientName} submitting={submitting} error={error} onRespond={(body) => void respond(body)} />
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-gray-400">
          Powered by BuildPanda · Figures are recorded amounts; no payment is taken through this page.
        </p>
      </div>
    </div>
  );
}
