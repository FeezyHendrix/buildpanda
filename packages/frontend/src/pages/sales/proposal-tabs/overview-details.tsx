import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { SaveTemplateDialog } from "@/components/molecules/save-template-dialog";
import type { ProposalWorkspace } from "@/api/proposals";
import { formatShortDate } from "@/lib/formatters";

interface Props {
  proposalId: string;
  proposal: ProposalWorkspace["proposal"];
  /** Only a proposal with an estimate has anything worth keeping as a template. */
  canSaveTemplate: boolean;
}

interface DetailRow {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}

function DetailsList({ rows }: { rows: DetailRow[] }) {
  const shown = rows.filter((r) => r.value);
  return (
    <dl className="divide-y divide-line-hair text-sm">
      {shown.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-gray-500">{row.label}</dt>
          <dd className={row.mono ? "font-mono text-xs text-gray-700" : "text-right text-gray-900"}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
DetailsList.displayName = "DetailsList";

// Who the proposal is for and what it is, as one list of rows. The only
// action here is keeping the proposal's terms and stages as a template.
export function OverviewDetails({ proposalId, proposal, canSaveTemplate }: Props) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const rows: DetailRow[] = [
    { label: "Client", value: proposal.clientName },
    { label: "Email", value: proposal.clientEmail },
    { label: "Phone", value: proposal.clientPhone },
    { label: "Location", value: proposal.location },
    { label: "Number", value: proposal.numberLabel, mono: true },
    { label: "Currency", value: proposal.currency },
    { label: "Valid until", value: proposal.validUntil ? formatShortDate(proposal.validUntil) : null },
    { label: "Created", value: formatShortDate(proposal.createdAt) },
  ];
  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase text-ink-muted">Details</h3>
        {canSaveTemplate ? (
          <Button variant="ghost" size="sm" onClick={() => setTemplateOpen(true)}>
            Save as template
          </Button>
        ) : null}
      </div>
      <DetailsList rows={rows} />
      {canSaveTemplate ? (
        <SaveTemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} proposalId={proposalId} suggestedName={proposal.title} />
      ) : null}
    </div>
  );
}
OverviewDetails.displayName = "OverviewDetails";
