import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import { useLeads, useUpdateLead } from "@/hooks/use-leads";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/api/leads";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<LeadStatus, "neutral" | "info" | "warning" | "success" | "danger" | "accent"> = {
  New: "info",
  Contacted: "accent",
  Qualified: "warning",
  ProposalOpened: "neutral",
  Won: "success",
  Lost: "danger",
};

const LIMIT = 25;

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"}>
      {status === "ProposalOpened" ? "Proposal Opened" : status}
    </Badge>
  );
}

function LeadRow({ lead }: { lead: Lead }) {
  const update = useUpdateLead();

  function handleStatusChange(status: LeadStatus) {
    update.mutate({ id: lead.id, status });
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">

      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{lead.name}</p>
        <p className="text-xs text-gray-500">{lead.email}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{lead.location ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{lead.projectType ?? "—"}</td>
      <td className="px-4 py-3">
        <LeadStatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {new Date(lead.createdAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <select
          value={lead.status}
          onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
          disabled={update.isPending}
          className={cn(
            "rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600",
            "outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/25",
          )}
          aria-label="Update status"
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "ProposalOpened" ? "Proposal Opened" : s}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

export default function LeadsPage() {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError } = useLeads({
    status: statusFilter || undefined,
    limit: LIMIT,
    offset,
  });

  const total = data?.total ?? 0;
  const leads = data?.rows ?? [];
  const hasNext = offset + LIMIT < total;
  const hasPrev = offset > 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leads</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Enquiries and prospects for your pre-construction pipeline.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as LeadStatus | "");
            setOffset(0);
          }}
          className={cn(
            "h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700",
            "outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/25",
          )}
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "ProposalOpened" ? "Proposal Opened" : s}
            </option>
          ))}
        </select>

        {total > 0 && (
          <span className="text-sm text-gray-400">
            {total} lead{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="size-7 animate-spin rounded-full border-2 border-gray-200 border-t-[#004DE7]" />
        </div>
      ) : isError ? (
        <EmptyState
          title="Could not load leads"
          description="Something went wrong. Please refresh and try again."
        />
      ) : leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description={
            statusFilter
              ? "No leads match this status filter."
              : "Leads from your consultation form and manual entries will appear here."
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Project type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Received
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Update
                  </th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </tbody>
            </table>
          </div>

          {(hasPrev || hasNext) && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setOffset(offset - LIMIT)}
                  disabled={!hasPrev}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setOffset(offset + LIMIT)}
                  disabled={!hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
