import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { EmptyState } from "@/components/molecules/empty-state";
import { useProposals } from "@/hooks/use-proposals";
import { useLeads } from "@/hooks/use-leads";
import type { ProposalListItem, ProposalStatus } from "@/api/proposals";
import type { Lead, LeadStatus } from "@/api/leads";
import { formatWholeCurrency } from "@/lib/formatters";
import { PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_TONE } from "@/lib/project-meta";
import { cn } from "@/lib/utils";

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

type AttentionTone = "danger" | "warning" | "info";

interface AttentionItem {
  id: string;
  to: string;
  tone: AttentionTone;
  text: string;
}

function buildAttention(proposals: ProposalListItem[], leads: Lead[]): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const p of proposals) {
    if (p.status === "Sent") {
      const d = daysUntil(p.validUntil);
      if (d !== null && d < 0) {
        items.push({ id: p.id, to: `/sales/proposals/${p.id}`, tone: "danger", text: `${p.numberLabel} ${p.title} — validity expired` });
      } else if (d !== null && d <= EXPIRING_WINDOW_DAYS) {
        items.push({ id: p.id, to: `/sales/proposals/${p.id}`, tone: "warning", text: `${p.numberLabel} ${p.title} — expires in ${d} day${d === 1 ? "" : "s"}` });
      }
    }
    if (p.status === "Accepted") {
      items.push({ id: p.id, to: `/sales/proposals/${p.id}`, tone: "info", text: `${p.numberLabel} ${p.title} — accepted, ready to convert` });
    }
  }

  for (const l of leads) {
    if (l.status === "New" && daysSince(l.createdAt) >= STALE_LEAD_DAYS) {
      items.push({ id: l.id, to: "/sales/leads", tone: "warning", text: `Lead "${l.name}" — no contact in ${daysSince(l.createdAt)} days` });
    }
  }

  const rank: Record<AttentionTone, number> = { danger: 0, warning: 1, info: 2 };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 6);
}

export default function SalesDashboard() {
  const navigate = useNavigate();
  const { data: proposalsData, isLoading: loadingProposals } = useProposals({ limit: 100 });
  const { data: leadsData, isLoading: loadingLeads } = useLeads({ limit: 100 });

  const proposals = proposalsData?.rows ?? [];
  const leads = leadsData?.rows ?? [];

  const m = useMemo(() => {
    const inPipeline = proposals.filter((p) => FUNNEL_STAGES.includes(p.status));
    const awaiting = proposals.filter((p) => AWAITING_REPLY.includes(p.status));
    const won = proposals.filter((p) => p.status === "Accepted" || p.status === "Converted");
    const lost = proposals.filter((p) => p.status === "Lost");
    const decided = won.length + lost.length;
    const readyToConvert = proposals.filter((p) => p.status === "Accepted").length;

    const funnel = FUNNEL_STAGES.map((status) => {
      const rows = proposals.filter((p) => p.status === status);
      return { status, count: rows.length, value: sumTotals(rows) };
    });

    const leadRows = LEAD_STAGES.map((s) => ({
      ...s,
      count: leads.filter((l) => l.status === s.status).length,
    }));

    const recent = [...proposals]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
          title="Your pipeline is empty"
          description="Capture a lead or draft your first proposal to start tracking deals here."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header onNew={() => navigate("/sales/proposals")} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard tone="brand" label="Pipeline value" value={formatWholeCurrency(m.pipelineValue, CURRENCY)} sub={`${m.openCount} open proposal${m.openCount === 1 ? "" : "s"}`} />
        <MetricCard tone="amber" label="Awaiting reply" value={String(m.awaitingCount)} sub="sent, awaiting client" />
        <MetricCard tone="green" label="Win rate" value={`${m.winRate}%`} sub={`${m.wonCount} won · ${m.lostCount} lost`} />
        <MetricCard tone="purple" label="Ready to convert" value={String(m.readyToConvert)} sub="accepted proposals" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FunnelPanel rows={m.funnel} />
        <AttentionPanel items={m.attention} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecentProposals rows={m.recent} />
        <LeadsPanel rows={m.leadRows} total={leads.length} />
      </div>
    </div>
  );
}

function Header({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Pre-Construction</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Your sales pipeline — from first enquiry to a signed build.
        </p>
      </div>
      <Button onClick={onNew}>New proposal</Button>
    </div>
  );
}

const METRIC_DOT: Record<"brand" | "green" | "amber" | "purple", string> = {
  brand: "bg-[#004DE7]",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  purple: "bg-violet-500",
};

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "brand" | "green" | "amber" | "purple";
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", METRIC_DOT[tone])} />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function FunnelPanel({ rows }: { rows: { status: ProposalStatus; count: number; value: number }[] }) {
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Pipeline by status</h2>
        <span className="text-xs text-gray-400">count · value</span>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.status} className="flex items-center gap-3">
            <div className="w-28 shrink-0">
              <Badge tone={PROPOSAL_STATUS_TONE[row.status] ?? "neutral"}>
                {PROPOSAL_STATUS_LABEL[row.status] ?? row.status}
              </Badge>
            </div>
            <span className="w-5 shrink-0 text-sm font-semibold text-gray-900">{row.count}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#004DE7]"
                style={{ width: `${Math.max(row.count === 0 ? 0 : 6, Math.round((row.count / maxCount) * 100))}%` }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-xs font-medium text-gray-500">
              {row.value > 0 ? formatWholeCurrency(row.value, CURRENCY) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ATTENTION_DOT: Record<AttentionTone, string> = {
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-[#004DE7]",
};

function AttentionPanel({ items }: { items: AttentionItem[] }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Needs attention</h2>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">Nothing needs attention — you're all caught up.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={`${item.tone}-${item.id}`}>
              <Link to={item.to} className="flex items-start gap-2.5 text-sm text-gray-700 hover:text-gray-900">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", ATTENTION_DOT[item.tone])} />
                <span className="leading-snug">{item.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LeadsPanel({
  rows,
  total,
}: {
  rows: { status: LeadStatus; label: string; tone: BadgeTone; count: number }[];
  total: number;
}) {
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Leads by status</h2>
        <span className="text-xs text-gray-400">{total} total</span>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.status} className="flex items-center gap-3">
            <div className="w-28 shrink-0">
              <Badge tone={row.tone}>{row.label}</Badge>
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-gray-400" style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }} />
            </div>
            <span className="w-5 shrink-0 text-right text-sm font-medium text-gray-700">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentProposals({ rows }: { rows: ProposalListItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white lg:col-span-2">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Recent proposals</h2>
        <Link to="/sales/proposals" className="text-xs font-medium text-[#004DE7] hover:underline">
          View all
        </Link>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => navigate(`/sales/proposals/${row.id}`)}
              className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"
            >
              <td className="px-5 py-3">
                <span className="font-mono text-xs font-medium text-gray-400">{row.numberLabel}</span>
              </td>
              <td className="px-5 py-3">
                <p className="font-medium text-gray-900">{row.title}</p>
                <p className="text-xs text-gray-500">{row.clientName}</p>
              </td>
              <td className="px-5 py-3">
                <Badge tone={PROPOSAL_STATUS_TONE[row.status] ?? "neutral"}>
                  {PROPOSAL_STATUS_LABEL[row.status] ?? row.status}
                </Badge>
              </td>
              <td className="px-5 py-3 text-right text-sm text-gray-700">
                {row.estimateTotal != null ? formatWholeCurrency(row.estimateTotal, row.currency) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
