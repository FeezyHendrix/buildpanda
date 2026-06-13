import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";
import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { useProposals, useCreateProposal } from "@/hooks/use-proposals";
import { PROPOSAL_STATUSES, type ProposalStatus, type ProposalListItem } from "@/api/proposals";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { formatShortDate, formatWholeCurrency } from "@/lib/formatters";
import {
  PROPOSAL_STATUS_LABEL as LABEL_MAP,
  PROPOSAL_STATUS_TONE as STATUS_TONE,
} from "@/lib/project-meta";
import { canDo } from "@/lib/permissions";
import { useMyOrgRole } from "@/hooks/use-organization";
import { cn } from "@/lib/utils";

function ProposalRow({ row }: { row: ProposalListItem }) {
  const navigate = useNavigate();
  return (
    <tr
      className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
      onClick={() => navigate(`/sales/proposals/${row.id}`)}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-medium text-gray-500">{row.numberLabel}</span>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{row.title}</p>
        <p className="text-xs text-gray-500">{row.clientName}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{row.location ?? "—"}</td>
      <td className="px-4 py-3">
        <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>
          {LABEL_MAP[row.status] ?? row.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {row.estimateTotal != null ? formatWholeCurrency(row.estimateTotal, row.currency) : "—"}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{formatShortDate(row.createdAt)}</td>
    </tr>
  );
}

interface PrefillSource {
  leadId?: string;
  title?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  location?: string;
  brief?: string;
}

function CreateProposalDrawer({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill?: PrefillSource;
}) {
  const navigate = useNavigate();
  const create = useCreateProposal();

  const [title, setTitle] = useState(prefill?.title ?? "");
  const [clientName, setClientName] = useState(prefill?.clientName ?? "");
  const [clientEmail, setClientEmail] = useState(prefill?.clientEmail ?? "");
  const [clientPhone, setClientPhone] = useState(prefill?.clientPhone ?? "");
  const [location, setLocation] = useState(prefill?.location ?? "");
  const [brief, setBrief] = useState(prefill?.brief ?? "");

  useEffect(() => {
    if (!open) return;
    setTitle(prefill?.title ?? "");
    setClientName(prefill?.clientName ?? "");
    setClientEmail(prefill?.clientEmail ?? "");
    setClientPhone(prefill?.clientPhone ?? "");
    setLocation(prefill?.location ?? "");
    setBrief(prefill?.brief ?? "");
  }, [open, prefill]);

  const isValid = title.trim().length > 0 && clientName.trim().length > 0;

  function reset() {
    setTitle("");
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setLocation("");
    setBrief("");
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleSubmit() {
    if (!isValid) return;
    const proposal = await create.mutateAsync({
      title: title.trim(),
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      location: location.trim() || undefined,
      brief: brief.trim() || undefined,
      leadId: prefill?.leadId,
    });
    onOpenChange(false);
    navigate(`/sales/proposals/${proposal.id}`);
  }

  const inputClass = "w-full";

  return (
    <FormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="New proposal"
      description="Enter the client details to get started. You can add an estimate from the workspace."
      submitLabel="Create proposal"
      submitDisabled={!isValid}
      submitting={create.isPending}
      error={create.isError ? "Failed to create proposal. Please try again." : null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prop-title">Project title *</Label>
        <Input
          id="prop-title"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. 3-bedroom residential build"
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prop-client-name">Client name *</Label>
        <Input
          id="prop-client-name"
          className={inputClass}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Full name or company"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prop-client-email">Client email</Label>
        <Input
          id="prop-client-email"
          type="email"
          className={inputClass}
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
          placeholder="client@example.com"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prop-client-phone">Client phone</Label>
        <Input
          id="prop-client-phone"
          className={inputClass}
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
          placeholder="+234 800 000 0000"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prop-location">Project location</Label>
        <Input
          id="prop-location"
          className={inputClass}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, State"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prop-brief">Brief / notes</Label>
        <textarea
          id="prop-brief"
          rows={3}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Short description of the project scope…"
          className={cn(
            "w-full rounded-lg bg-[#F6F6F6] px-4 py-3 text-sm text-gray-900",
            "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
            "resize-none placeholder:text-gray-400",
          )}
        />
      </div>
    </FormDrawer>
  );
}

export default function ProposalsPage() {
  const role = useMyOrgRole();
  const canCreate = canDo(role, "proposals", "create");

  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "">("");
  const [offset, setOffset] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const prefill: PrefillSource = {
    leadId: searchParams.get("leadId") ?? undefined,
    title: searchParams.get("title") ?? undefined,
    clientName: searchParams.get("clientName") ?? undefined,
    clientEmail: searchParams.get("clientEmail") ?? undefined,
    clientPhone: searchParams.get("clientPhone") ?? undefined,
    location: searchParams.get("location") ?? undefined,
    brief: searchParams.get("brief") ?? undefined,
  };

  useEffect(() => {
    if (searchParams.get("clientName") || searchParams.get("leadId")) {
      setDrawerOpen(true);
    }
  }, [searchParams]);

  function handleDrawerOpenChange(v: boolean) {
    setDrawerOpen(v);
    if (!v && (searchParams.get("leadId") || searchParams.get("clientName"))) {
      const next = new URLSearchParams(searchParams);
      ["leadId", "title", "clientName", "clientEmail", "clientPhone", "location", "brief"].forEach((k) =>
        next.delete(k),
      );
      setSearchParams(next, { replace: true });
    }
  }

  const { data, isLoading, isError } = useProposals({
    status: statusFilter || undefined,
    limit: DEFAULT_PAGE_SIZE,
    offset,
  });

  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];
  const hasNext = offset + DEFAULT_PAGE_SIZE < total;
  const hasPrev = offset > 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Proposals</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Pre-construction proposals and estimates for your clients.
          </p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={() => setDrawerOpen(true)}>
            New proposal
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as ProposalStatus | "");
            setOffset(0);
          }}
          className={cn(
            "h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700",
            "outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7]/25",
          )}
        >
          <option value="">All statuses</option>
          {PROPOSAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LABEL_MAP[s]}
            </option>
          ))}
        </select>

        {total > 0 && (
          <span className="text-sm text-gray-400">
            {total} proposal{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="md" />
        </div>
      ) : isError ? (
        <EmptyState
          title="Could not load proposals"
          description="Something went wrong. Please refresh and try again."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No proposals yet"
          description={
            statusFilter
              ? "No proposals match this status filter."
              : "Create your first proposal to get started."
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Estimate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ProposalRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          {(hasPrev || hasNext) && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">
                {offset + 1}–{Math.min(offset + DEFAULT_PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setOffset(offset - DEFAULT_PAGE_SIZE)}
                  disabled={!hasPrev}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setOffset(offset + DEFAULT_PAGE_SIZE)}
                  disabled={!hasNext}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {canCreate && (
        <CreateProposalDrawer
          open={drawerOpen}
          onOpenChange={handleDrawerOpenChange}
          prefill={prefill}
        />
      )}
    </div>
  );
}
