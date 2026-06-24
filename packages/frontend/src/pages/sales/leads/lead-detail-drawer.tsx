import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Label } from "@/components/atoms/label";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { useUpdateLead } from "@/hooks/use-leads";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/api/leads";
import { formatShortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { statusLabel } from "./lead-status-badge";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-700">{value}</dd>
    </div>
  );
}

export function LeadDetailDrawer({
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
            disabled={!notesDirty}
            loading={savingNotes}
            onClick={saveNotes}
          >
            {savingNotes ? "Saving…" : notesDirty ? "Save notes" : "Saved"}
          </Button>
        </div>
      </div>
    </FormDrawer>
  );
}
