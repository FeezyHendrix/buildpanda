import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { Tabs } from "@/components/molecules/tabs";
import { useProposalWorkspace } from "@/hooks/use-proposals";
import { formatWholeCurrency as fmt } from "@/lib/formatters";
import {
  PROPOSAL_STATUS_LABEL as LABEL_MAP,
  PROPOSAL_STATUS_TONE as STATUS_TONE,
} from "@/lib/project-meta";
import { ActivityTab } from "./proposal-tabs/activity-tab";
import { DrawingsTab } from "./proposal-tabs/drawings-tab";
import { EstimateTab } from "./proposal-tabs/estimate-tab";
import { MessagesTab } from "./proposal-tabs/messages-tab";
import { OverviewTab } from "./proposal-tabs/overview-tab";
import { PackTab } from "./proposal-tabs/pack-tab";
import { TakeoffsTab } from "./proposal-tabs/takeoffs-tab";
import { SafetyTab } from "./proposal-tabs/safety-tab";
import { JOB_PROFILE_META } from "@/lib/precon-meta";

// The take-off is the bill of quantities, so there is no separate BoQ grid.
// Messages fold into Activity as internal notes.
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "drawings", label: "Drawings" },
  { id: "takeoffs", label: "Take-offs" },
  { id: "estimate", label: "Estimate" },
  { id: "pack", label: "Pack" },
  { id: "safety", label: "Safety" },
  { id: "activity", label: "Activity" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const isTab = (value: string | null): value is Tab => TABS.some((t) => t.id === value);

export default function ProposalWorkspace() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // The tab lives in the URL so a take-off's "Back to proposal" link, a reload
  // or a shared link all land on the same tab the user left.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: Tab = isTab(rawTab) ? rawTab : "overview";
  const setTab = (next: Tab) => setSearchParams(next === "overview" ? {} : { tab: next }, { replace: true });

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
          action={{ label: "Back to proposals", onClick: () => navigate("/sales/proposals") }}
        />
      </div>
    );
  }

  const { proposal, estimate } = data;

  return (
    <div className="flex flex-col">
      <div className="border-b border-line-hair px-6 py-5">
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
          {estimate ? (
            <span className="text-sm font-semibold text-gray-700">{fmt(estimate.total, proposal.currency)}</span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {proposal.clientName} · {JOB_PROFILE_META[proposal.jobProfile].label}
        </p>
      </div>

      <Tabs
        items={TABS.map((t) => ({
          ...t,
          badge: t.id === "estimate" && estimate ? estimate.revisionLabel : undefined,
        }))}
        value={tab}
        onChange={setTab}
        className="px-6"
        ariaLabel="Proposal sections"
      />

      <div className="p-6">
        {tab === "overview" ? <OverviewTab proposalId={id} /> : null}
        {tab === "drawings" ? <DrawingsTab proposalId={id} /> : null}
        {tab === "takeoffs" ? <TakeoffsTab proposalId={id} /> : null}
        {tab === "estimate" ? (
          <EstimateTab
            proposalId={id}
            estimate={estimate}
            currency={proposal.currency}
            projectId={proposal.projectId}
            validUntil={proposal.validUntil}
          />
        ) : null}
        {tab === "pack" ? <PackTab proposalId={id} /> : null}
        {tab === "activity" ? (
          <div className="flex flex-col gap-8">
            <ActivityTab proposalId={id} />
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-medium uppercase text-ink-muted">Internal notes</h2>
              <MessagesTab proposalId={id} />
            </section>
          </div>
        ) : null}
        {tab === "safety" ? <SafetyTab proposalId={id} /> : null}
      </div>
    </div>
  );
}
