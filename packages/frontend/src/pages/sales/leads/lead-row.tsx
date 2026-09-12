import { TableCell, TableRow } from "@/components/atoms/table";
import { useUpdateLead } from "@/hooks/use-leads";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/api/leads";
import { formatShortDate } from "@/lib/formatters";
import { LeadStatusBadge, statusLabel } from "./lead-status-badge";
import { INPUT_SM_CLASS } from "@/components/atoms/input";

export function LeadRow({ lead, onOpen }: { lead: Lead; onOpen: (lead: Lead) => void }) {
  const update = useUpdateLead();

  function handleStatusChange(status: LeadStatus) {
    update.mutate({ id: lead.id, status });
  }

  return (
    <TableRow onClick={() => onOpen(lead)}>
      <TableCell>
        <p className="font-medium text-gray-900">{lead.name}</p>
        <p className="text-xs text-gray-500">{lead.email}</p>
      </TableCell>
      <TableCell className="text-gray-600">{lead.location ?? "-"}</TableCell>
      <TableCell className="text-gray-600">{lead.projectType ?? "-"}</TableCell>
      <TableCell>
        <LeadStatusBadge status={lead.status} />
      </TableCell>
      <TableCell className="text-xs text-gray-400">{formatShortDate(lead.createdAt)}</TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <select
          value={lead.status}
          onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
          disabled={update.isPending}
          className={INPUT_SM_CLASS}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </TableCell>
    </TableRow>
  );
}
