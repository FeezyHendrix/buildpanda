import { useState } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import { useLeads } from "@/hooks/use-leads";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/api/leads";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { Can } from "@/components/atoms/can";
import { cn } from "@/lib/utils";

import { statusLabel } from "./leads/lead-status-badge";
import { CreateLeadDrawer } from "./leads/create-lead-drawer";
import { LeadDetailDrawer } from "./leads/lead-detail-drawer";
import { LeadRow } from "./leads/lead-row";

export default function LeadsPage() {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [offset, setOffset] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const { data, isLoading, isError } = useLeads({
    status: statusFilter || undefined,
    limit: DEFAULT_PAGE_SIZE,
    offset,
  });

  const total = data?.total ?? 0;
  const leads = data?.rows ?? [];
  const hasNext = offset + DEFAULT_PAGE_SIZE < total;
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
        <Can do="create" on="leads">
          <Button onClick={() => setCreateOpen(true)}>+ New lead</Button>
        </Can>
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
              {statusLabel(s)}
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
          <Spinner size="md" />
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
              : "Leads from your consultation form will appear here, or add one manually with the button above."
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Received</th>
                  <th className="w-32 px-4 py-3 font-medium">Update</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} onOpen={setActiveLead} />
                ))}
              </tbody>
            </table>
          </div>

          {(hasPrev || hasNext) && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasPrev}
                onClick={() => setOffset(offset - DEFAULT_PAGE_SIZE)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset(offset + DEFAULT_PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <Can do="create" on="leads">
        <CreateLeadDrawer open={createOpen} onOpenChange={setCreateOpen} />
      </Can>
      <LeadDetailDrawer lead={activeLead} onClose={() => setActiveLead(null)} />
    </div>
  );
}
