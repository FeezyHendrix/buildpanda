import { Link, useNavigate } from "react-router-dom";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/atoms/table";
import type { ProposalListItem, ProposalStatus } from "@/api/proposals";
import type { LeadStatus } from "@/api/leads";
import { formatWholeCurrency } from "@/lib/formatters";
import { PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_TONE } from "@/lib/project-meta";
import { cn } from "@/lib/utils";

const CURRENCY = "NGN";

type AttentionTone = "danger" | "warning" | "info";

interface AttentionItem {
  id: string;
  to: string;
  tone: AttentionTone;
  text: string;
}

const METRIC_DOT: Record<"brand" | "green" | "amber" | "purple", string> = {
  brand: "bg-primary-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  purple: "bg-violet-500",
};

export function MetricCard({
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
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-5">
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", METRIC_DOT[tone])} />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-gray-900">
        {value}
      </p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

export function FunnelPanel({
  rows,
}: {
  rows: { status: ProposalStatus; count: number; value: number }[];
}) {
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 lg:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">
          Pipeline by status
        </h2>
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
            <span className="w-5 shrink-0 text-sm font-semibold text-gray-900">
              {row.count}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary-500"
                style={{
                  width: `${Math.max(row.count === 0 ? 0 : 6, Math.round((row.count / maxCount) * 100))}%`,
                }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-xs font-medium text-gray-500">
              {row.value > 0 ? formatWholeCurrency(row.value, CURRENCY) : "-"}
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
  info: "bg-primary-500",
};

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Needs attention</h2>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">
          Nothing needs attention. You're all caught up.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={`${item.tone}-${item.id}`}>
              <Link
                to={item.to}
                className="flex items-start gap-2.5 text-sm text-gray-700 hover:text-gray-900"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    ATTENTION_DOT[item.tone],
                  )}
                />
                <span className="leading-snug">{item.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LeadsPanel({
  rows,
  total,
}: {
  rows: { status: LeadStatus; label: string; tone: BadgeTone; count: number }[];
  total: number;
}) {
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5">
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
              <div
                className="h-full rounded-full bg-gray-400"
                style={{
                  width: `${Math.round((row.count / maxCount) * 100)}%`,
                }}
              />
            </div>
            <span className="w-5 shrink-0 text-right text-sm font-medium text-gray-700">
              {row.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecentProposals({ rows }: { rows: ProposalListItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white lg:col-span-2">
      <div className="flex items-center justify-between border-b border-line-hair px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">
          Recent proposals
        </h2>
        <Link
          to="/sales/proposals"
          className="text-xs font-medium text-primary-500 hover:underline"
        >
          View all
        </Link>
      </div>
      <Table>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} onClick={() => navigate(`/sales/proposals/${row.id}`)}>
              <TableCell>
                <span className="font-mono text-xs font-medium text-gray-400">
                  {row.numberLabel}
                </span>
              </TableCell>
              <TableCell>
                <p className="font-medium text-gray-900">{row.title}</p>
                <p className="text-xs text-gray-500">{row.clientName}</p>
              </TableCell>
              <TableCell>
                <Badge tone={PROPOSAL_STATUS_TONE[row.status] ?? "neutral"}>
                  {PROPOSAL_STATUS_LABEL[row.status] ?? row.status}
                </Badge>
              </TableCell>
              <TableCell align="right" className="text-gray-700">
                {row.estimateTotal != null
                  ? formatWholeCurrency(row.estimateTotal, row.currency)
                  : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

MetricCard.displayName = "MetricCard";
FunnelPanel.displayName = "FunnelPanel";
AttentionPanel.displayName = "AttentionPanel";
LeadsPanel.displayName = "LeadsPanel";
RecentProposals.displayName = "RecentProposals";

export type { AttentionItem, AttentionTone };
