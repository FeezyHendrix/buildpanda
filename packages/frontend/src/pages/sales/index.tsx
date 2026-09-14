import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { TourGuide } from "@/components/molecules/tour-guide";
import { useProposals } from "@/hooks/use-proposals";
import { useLeads } from "@/hooks/use-leads";
import { useTour } from "@/hooks/use-tour";
import { SALES_TOUR_KEY, SALES_TOUR_STEPS } from "@/lib/tour-steps";
import type { ProposalListItem, ProposalStatus } from "@/api/proposals";
import type { Lead, LeadStatus } from "@/api/leads";
import { formatWholeCurrency } from "@/lib/formatters";
import { PageHeader } from "@/components";
import {
  AttentionPanel,
  FunnelPanel,
  LeadsPanel,
  MetricCard,
  RecentProposals,
  type AttentionItem,
  type AttentionTone,
} from "./dashboard-panels";

const CURRENCY = "NGN";
const EXPIRING_WINDOW_DAYS = 7;
const STALE_LEAD_DAYS = 3;

const FUNNEL_STAGES: ProposalStatus[] = [
  "New",
  "Preparing",
  "Sent",
  "UnderReview",
  "Revising",
  "Accepted",
];

const AWAITING_REPLY: ProposalStatus[] = ["Sent", "UnderReview", "Revising"];

const LEAD_STAGES: { status: LeadStatus; label: string; tone: BadgeTone }[] = [
  { status: "New", label: "New", tone: "info" },
  { status: "Contacted", label: "Contacted", tone: "accent" },
  { status: "Qualified", label: "Qualified", tone: "warning" },
  { status: "ProposalOpened", label: "Proposal Opened", tone: "neutral" },
  { status: "Won", label: "Won", tone: "success" },
  { status: "Lost", label: "Lost", tone: "danger" },
];

function sumTotals(rows: ProposalListItem[]): number {
  return rows.reduce((acc, r) => acc + (r.estimateTotal ?? 0), 0);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.ceil((then - Date.now()) / 86_400_000);
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function buildAttention(
  proposals: ProposalListItem[],
  leads: Lead[],
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const p of proposals) {
    if (p.status === "Sent") {
      const d = daysUntil(p.validUntil);
      if (d !== null && d < 0) {
        items.push({
          id: p.id,
          to: `/sales/proposals/${p.id}`,
          tone: "danger",
          text: `${p.numberLabel} ${p.title}: validity expired`,
        });
      } else if (d !== null && d <= EXPIRING_WINDOW_DAYS) {
        items.push({
          id: p.id,
          to: `/sales/proposals/${p.id}`,
          tone: "warning",
          text: `${p.numberLabel} ${p.title}: expires in ${d} day${d === 1 ? "" : "s"}`,
        });
      }
    }
    if (p.status === "Accepted") {
      items.push({
        id: p.id,
        to: `/sales/proposals/${p.id}`,
        tone: "info",
        text: `${p.numberLabel} ${p.title}: accepted, ready to convert`,
      });
    }
  }

  for (const l of leads) {
    if (l.status === "New" && daysSince(l.createdAt) >= STALE_LEAD_DAYS) {
      items.push({
        id: l.id,
        to: "/sales/leads",
        tone: "warning",
        text: `Lead "${l.name}": no contact in ${daysSince(l.createdAt)} days`,
      });
    }
  }

  const rank: Record<AttentionTone, number> = {
    danger: 0,
    warning: 1,
    info: 2,
  };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 6);
}

export default function SalesDashboard() {
  const navigate = useNavigate();
  const { data: proposalsData, isLoading: loadingProposals } = useProposals({
    limit: 100,
  });
  const { data: leadsData, isLoading: loadingLeads } = useLeads({ limit: 100 });

  const proposals = proposalsData?.rows ?? [];
  const leads = leadsData?.rows ?? [];

  const tour = useTour({
    tourKey: SALES_TOUR_KEY,
    steps: SALES_TOUR_STEPS,
    enabled: !loadingProposals && !loadingLeads,
  });

  const m = useMemo(() => {
    const inPipeline = proposals.filter((p) =>
      FUNNEL_STAGES.includes(p.status),
    );
    const awaiting = proposals.filter((p) => AWAITING_REPLY.includes(p.status));
    const won = proposals.filter(
      (p) => p.status === "Accepted" || p.status === "Converted",
    );
    const lost = proposals.filter((p) => p.status === "Lost");
    const decided = won.length + lost.length;
    const readyToConvert = proposals.filter(
      (p) => p.status === "Accepted",
    ).length;

    const funnel = FUNNEL_STAGES.map((status) => {
      const rows = proposals.filter((p) => p.status === status);
      return { status, count: rows.length, value: sumTotals(rows) };
    });

    const leadRows = LEAD_STAGES.map((s) => ({
      ...s,
      count: leads.filter((l) => l.status === s.status).length,
    }));

    const recent = [...proposals]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5);

    return {
      pipelineValue: sumTotals(inPipeline),
      openCount: inPipeline.length,
      awaitingCount: awaiting.length,
      winRate: decided > 0 ? Math.round((won.length / decided) * 100) : 0,
      wonCount: won.length,
      lostCount: lost.length,
      readyToConvert,
      funnel,
      leadRows,
      attention: buildAttention(proposals, leads),
      recent,
    };
  }, [proposals, leads]);

  if (loadingProposals || loadingLeads) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="md" />
      </div>
    );
  }

  if (proposals.length === 0 && leads.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header onNew={() => navigate("/sales/proposals")} />
        <EmptyState
          title="No deals in the pipeline yet"
          description="Capture a lead or draft your first proposal to start tracking deals here."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header onNew={() => navigate("/sales/proposals")} />

      <div
        data-tour="sales-metrics"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <MetricCard
          tone="brand"
          label="Pipeline value"
          value={formatWholeCurrency(m.pipelineValue, CURRENCY)}
          sub={`${m.openCount} open proposal${m.openCount === 1 ? "" : "s"}`}
        />
        <MetricCard
          tone="amber"
          label="Awaiting reply"
          value={String(m.awaitingCount)}
          sub="sent, awaiting client"
        />
        <MetricCard
          tone="green"
          label="Win rate"
          value={`${m.winRate}%`}
          sub={`${m.wonCount} won · ${m.lostCount} lost`}
        />
        <MetricCard
          tone="purple"
          label="Ready to convert"
          value={String(m.readyToConvert)}
          sub="accepted proposals"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div data-tour="sales-funnel" className="lg:col-span-2">
          <FunnelPanel rows={m.funnel} />
        </div>
        <div data-tour="sales-attention">
          <AttentionPanel items={m.attention} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecentProposals rows={m.recent} />
        <LeadsPanel rows={m.leadRows} total={leads.length} />
      </div>

      <TourGuide
        active={tour.active}
        step={tour.step}
        index={tour.index}
        total={tour.total}
        onNext={tour.next}
        onBack={tour.back}
        onSkip={tour.skip}
      />
    </div>
  );
}

function Header({ onNew }: { onNew: () => void }) {
  return (
    <PageHeader
      title="Pre-Construction"
      actions={
        <Button
          variant="primary"
          size="md"
          data-tour="sales-new"
          onClick={onNew}
        >
          New Proposal
        </Button>
      }
    />
  );
}
