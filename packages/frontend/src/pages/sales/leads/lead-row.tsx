import { useUpdateLead } from "@/hooks/use-leads";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/api/leads";
import { formatShortDate } from "@/lib/formatters";
import { LeadStatusBadge, statusLabel } from "./lead-status-badge";

export function LeadRow({ lead, onOpen }: { lead: Lead; onOpen: (lead: Lead) => void }) {
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
      <td className="px-4 py-3 text-sm text-gray-600">{lead.location ?? "-"}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{lead.projectType ?? "-"}</td>
      <td className="px-4 py-3">
        <LeadStatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">{formatShortDate(lead.createdAt)}</td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <select
          value={lead.status}
          onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
          disabled={update.isPending}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none hover:border-gray-300 focus-visible:border-[#004DE7]"
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
