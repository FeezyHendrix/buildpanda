import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { useProposals, useCreateProposal } from "@/hooks/use-proposals";
import { PROPOSAL_STATUSES, type ProposalStatus, type ProposalListItem } from "@/api/proposals";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<
  ProposalStatus,
  "neutral" | "info" | "warning" | "success" | "danger" | "accent"
> = {
  New: "info",
  Preparing: "accent",
  Sent: "warning",
  UnderReview: "warning",
  Revising: "accent",
  Accepted: "success",
  Converted: "success",
  Lost: "danger",
  Expired: "neutral",
};

const LABEL_MAP: Record<ProposalStatus, string> = {
  New: "New",
  Preparing: "Preparing",
  Sent: "Sent",
  UnderReview: "Under Review",
  Revising: "Revising",
  Accepted: "Accepted",
  Converted: "Converted",
  Lost: "Lost",
  Expired: "Expired",
};

const LIMIT = 25;

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

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
        {row.estimateTotal != null ? fmt(row.estimateTotal, row.currency) : "—"}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {new Date(row.createdAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </td>
    </tr>
  );
}

function CreateProposalDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const create = useCreateProposal();

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [location, setLocation] = useState("");
  const [brief, setBrief] = useState("");

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
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | "">("");
  const [offset, setOffset] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading, isError } = useProposals({
    status: statusFilter || undefined,
    limit: LIMIT,
    offset,
  });

  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];
  const hasNext = offset + LIMIT < total;
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
        <Button variant="primary" onClick={() => setDrawerOpen(true)}>
          New proposal
        </Button>
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
          <div className="size-7 animate-spin rounded-full border-2 border-gray-200 border-t-[#004DE7]" />
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

      <CreateProposalDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
