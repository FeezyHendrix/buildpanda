import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { formatShortDate } from "@/lib/formatters";
import { RISK_SEVERITY_META, RISK_STATUS_META } from "@/lib/risk-meta";
import type { RiskFactor, RiskStatus } from "@/lib/project-types";

interface RiskRowProps {
  risk: RiskFactor;
  canManage: boolean;
  activityName: string | null;
  busy: boolean;
  onEdit: (risk: RiskFactor) => void;
  onDelete: (risk: RiskFactor) => void;
  onSetStatus: (risk: RiskFactor, status: RiskStatus) => void;
}

/** The status a risk normally moves to next, offered as a one-click action. */
const NEXT_STATUS: Partial<Record<RiskStatus, { status: RiskStatus; label: string }[]>> = {
  open: [
    { status: "mitigated", label: "Mark mitigated" },
    { status: "occurred", label: "It happened" },
    { status: "closed", label: "Close out" },
  ],
  mitigated: [
    { status: "occurred", label: "It happened" },
    { status: "closed", label: "Close out" },
    { status: "open", label: "Reopen" },
  ],
  occurred: [{ status: "closed", label: "Close out" }],
  closed: [{ status: "open", label: "Reopen" }],
};

function RiskRow({ risk, canManage, activityName, busy, onEdit, onDelete, onSetStatus }: RiskRowProps) {
  const severity = RISK_SEVERITY_META[risk.severity];
  const status = RISK_STATUS_META[risk.status ?? "open"];

  return (
    <article className="rounded-2xl border border-[#EDEDED] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={severity.tone} size="sm">
              {severity.shape} {severity.label}
            </Badge>
            <Badge tone={status.tone} size="sm">
              {status.label}
            </Badge>
            {activityName ? (
              <Badge tone="accent" size="sm">
                Activity: {activityName}
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">{risk.title}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{risk.description}</p>
          {risk.mitigation ? (
            <p className="mt-2 rounded-lg bg-surface-alt p-3 text-sm text-gray-700">
              <span className="font-medium text-gray-900">Response: </span>
              {risk.mitigation}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-gray-400">
            {risk.ownerName ? `Owner ${risk.ownerName}` : "No owner"}
            {risk.reviewDate ? ` · Review ${formatShortDate(risk.reviewDate)}` : ""}
            {risk.closedAt ? ` · ${status.label} ${formatShortDate(risk.closedAt)}` : ""}
          </p>
        </div>

        {canManage ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {(NEXT_STATUS[risk.status ?? "open"] ?? []).map((action) => (
              <Button
                key={action.status}
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onSetStatus(risk, action.status)}
              >
                {action.label}
              </Button>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => onEdit(risk)}>
              Edit
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={() => onDelete(risk)}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

RiskRow.displayName = "RiskRow";

export { RiskRow, type RiskRowProps };
