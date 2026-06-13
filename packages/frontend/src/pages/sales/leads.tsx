import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { Spinner } from "@/components/atoms/spinner";
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { EmptyState } from "@/components/molecules/empty-state";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useCreateLead, useLeads, useUpdateLead } from "@/hooks/use-leads";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/api/leads";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { formatShortDate } from "@/lib/formatters";
import { canDo } from "@/lib/permissions";
import { useMyOrgRole } from "@/hooks/use-organization";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<LeadStatus, "neutral" | "info" | "warning" | "success" | "danger" | "accent"> = {
  New: "info",
  Contacted: "accent",
  Qualified: "warning",
  ProposalOpened: "neutral",
  Won: "success",
  Lost: "danger",
};

function statusLabel(s: LeadStatus): string {
  return s === "ProposalOpened" ? "Proposal Opened" : s;
}

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{statusLabel(status)}</Badge>;
}

function CreateLeadDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const create = useCreateLead();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [projectType, setProjectType] = useState("");
  const [message, setMessage] = useState("");

  const isValid = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setLocation("");
    setProjectType("");
    setMessage("");
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleSubmit() {
    if (!isValid) return;
    await create.mutateAsync({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      location: location.trim() || undefined,
      projectType: projectType.trim() || undefined,
      message: message.trim() || undefined,
    });
    handleOpenChange(false);
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="New lead"
      description="Add a prospect you spoke to off-platform. You can create a proposal for them later."
      submitLabel="Add lead"
      submitDisabled={!isValid}
      submitting={create.isPending}
      error={create.isError ? "Failed to create lead. Please try again." : null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-name">Full name *</Label>
        <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-email">Email *</Label>
        <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-phone">Phone</Label>
        <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 800 000 0000" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-location">Location</Label>
        <Input id="lead-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-project-type">Project type</Label>
        <Input id="lead-project-type" value={projectType} onChange={(e) => setProjectType(e.target.value)} placeholder="Residential, Commercial, …" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-message">Notes</Label>
        <textarea
          id="lead-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything you want to remember about this prospect…"
          className="w-full resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>
    </FormDrawer>
  );
}

function LeadDetailDrawer({
  lead,
  onClose,
}: {
  lead: Lead | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const update = useUpdateLead();
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    setNotes(lead?.notes ?? "");
  }, [lead?.id, lead?.notes]);

  if (!lead) return null;

  async function saveNotes() {
    if (!lead) return;
    setSavingNotes(true);
    try {
      await update.mutateAsync({ id: lead.id, notes });
    } finally {
      setSavingNotes(false);
    }
  }

  async function changeStatus(status: LeadStatus) {
    if (!lead) return;
    await update.mutateAsync({ id: lead.id, status });
  }

  function createProposal() {
    if (!lead) return;
    const params = new URLSearchParams({
      leadId: lead.id,
      clientName: lead.name,
      title: lead.projectType ? `${lead.projectType} for ${lead.name}` : `Proposal for ${lead.name}`,
    });
    if (lead.email) params.set("clientEmail", lead.email);
    if (lead.phone) params.set("clientPhone", lead.phone);
    if (lead.location) params.set("location", lead.location);
    if (lead.message) params.set("brief", lead.message);
    navigate(`/sales/proposals?${params.toString()}`);
  }

  const notesDirty = notes !== (lead.notes ?? "");

  return (
    <FormDrawer
      open
      onOpenChange={(v) => { if (!v) onClose(); }}
      title={lead.name}
      description={lead.email}
      submitLabel="Create proposal"
      onSubmit={createProposal}
    >
      <div className="flex flex-col gap-1.5">
        <Label>Status</Label>
        <div className="flex flex-wrap gap-2">
          {LEAD_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeStatus(s)}
              disabled={update.isPending}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                lead.status === s
                  ? "border-[#004DE7] bg-[#004DE7] text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
              )}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {lead.phone && <Field label="Phone" value={lead.phone} />}
        {lead.location && <Field label="Location" value={lead.location} />}
        {lead.projectType && <Field label="Project type" value={lead.projectType} />}
        <Field label="Source" value={lead.source} />
        <Field label="Received" value={formatShortDate(lead.createdAt)} />
      </dl>

      {lead.message && (
        <div className="flex flex-col gap-1.5">
          <Label>Original message</Label>
          <p className="whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{lead.message}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lead-notes">Internal notes</Label>
        <textarea
          id="lead-notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Call summary, next steps, anything to remember…"
          className="w-full resize-none rounded-lg bg-[#F6F6F6] px-3 py-2 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!notesDirty || savingNotes}
            onClick={saveNotes}
          >
            {savingNotes ? "Saving…" : notesDirty ? "Save notes" : "Saved"}
          </Button>
        </div>
      </div>
    </FormDrawer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-700">{value}</dd>
    </div>
  );
}

function LeadRow({ lead, onOpen }: { lead: Lead; onOpen: (lead: Lead) => void }) {
  const update = useUpdateLead();

  function handleStatusChange(status: LeadStatus) {
    update.mutate({ id: lead.id, status });
  }

  return (
    <tr
      className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
      onClick={() => onOpen(lead)}
    >
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{lead.name}</p>
        <p className="text-xs text-gray-500">{lead.email}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{lead.location ?? "—"}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{lead.projectType ?? "—"}</td>
      <td className="px-4 py-3">
        <LeadStatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{formatShortDate(lead.createdAt)}</td>
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
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

export default function LeadsPage() {
  const role = useMyOrgRole();
  const canCreate = canDo(role, "leads", "create");

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
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>+ New lead</Button>
        )}
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
                  <th className="px-4 py-3 font-medium">Project type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Received</th>
                  <th className="px-4 py-3 font-medium">Update</th>
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

      {canCreate && (
        <CreateLeadDrawer open={createOpen} onOpenChange={setCreateOpen} />
      )}
      <LeadDetailDrawer lead={activeLead} onClose={() => setActiveLead(null)} />
    </div>
  );
}
