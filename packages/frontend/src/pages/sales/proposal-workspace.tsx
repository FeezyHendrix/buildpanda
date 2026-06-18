import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { useProposalWorkspace } from "@/hooks/use-proposals";
import { formatWholeCurrency as fmt } from "@/lib/formatters";
import {
  PROPOSAL_STATUS_LABEL as LABEL_MAP,
  PROPOSAL_STATUS_TONE as STATUS_TONE,
} from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import { ActivityTab } from "./proposal-tabs/activity-tab";
import { BoqTab } from "./proposal-tabs/boq-tab";
import { EstimateTab } from "./proposal-tabs/estimate-tab";
import { MessagesTab } from "./proposal-tabs/messages-tab";
import { OverviewTab } from "./proposal-tabs/overview-tab";
import { PlansTab } from "./proposal-tabs/plans-tab";

type Tab = "overview" | "plans" | "boq" | "estimate" | "messages" | "activity";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "plans", label: "Plans" },
  { id: "boq", label: "BoQ" },
  { id: "estimate", label: "Estimate" },
  { id: "messages", label: "Messages" },
  { id: "activity", label: "Activity" },
];

export default function ProposalWorkspace() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  const { data, isLoading, isError } = useProposalWorkspace(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <EmptyState
          title="Proposal not found"
          description="This proposal may have been deleted or you don't have access."
        />
        <Button variant="secondary" onClick={() => navigate("/sales/proposals")} className="mt-4">
          Back to proposals
        </Button>
      </div>
    );
  }

  const { proposal, estimate } = data;

  const tabClass = (t: Tab) =>
    cn(
      "px-4 py-2 text-sm font-medium transition-colors",
      tab === t
        ? "border-b-2 border-[#004DE7] text-[#004DE7]"
        : "text-gray-500 hover:text-gray-700",
    );

  return (
    <div className="flex flex-col">
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
          <Link to="/sales/proposals" className="hover:text-gray-600">
            Proposals
          </Link>
          <span>/</span>
          <span className="font-mono">{proposal.numberLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{proposal.title}</h1>
            <Badge tone={STATUS_TONE[proposal.status] ?? "neutral"}>
              {LABEL_MAP[proposal.status] ?? proposal.status}
            </Badge>
          </div>
          {estimate && (
            <span className="text-sm font-semibold text-gray-700">
              {fmt(estimate.total, proposal.currency)}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">{proposal.clientName}</p>
      </div>

      <div className="flex gap-1 border-b border-gray-100 px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tabClass(t.id)}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "estimate" && estimate && (
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                {estimate.revisionLabel}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === "overview" && <OverviewTab proposalId={id} />}
        {tab === "plans" && <PlansTab proposalId={id} />}
        {tab === "boq" && <BoqTab proposalId={id} estimateId={estimate?.id ?? null} />}
        {tab === "estimate" && (
          <EstimateTab proposalId={id} estimate={estimate} currency={proposal.currency} projectId={proposal.projectId} />
        )}
        {tab === "messages" && <MessagesTab proposalId={id} />}
        {tab === "activity" && <ActivityTab proposalId={id} />}
      </div>
    </div>
  );
}
