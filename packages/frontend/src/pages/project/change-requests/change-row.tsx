import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { CHANGE_STATUS_META } from "@/components/molecules/change-request-detail-dialog";
import { ChangeTypeBadge } from "@/components/molecules/change-request-context";
import { formatWholeCurrency } from "@/lib/formatters";
import type { ChangeRequest } from "@/lib/project-types";
import { ContractChip } from "./contract-chip";

/**
 * One row of the change-order register.
 *
 * A time claim reads differently from a variation and must: it has no money,
 * so showing ₦0 tells a QS nothing, while the days claimed against the days
 * awarded is the whole negotiation — "14 claimed, 9 awarded" is the record of
 * what the engineer actually granted.
 */
interface ChangeRowProps {
  cr: ChangeRequest;
  projectId: string;
  canManage: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function TimeClaimFigures({ cr }: { cr: ChangeRequest }) {
  return (
    <>
      <span className="font-medium text-ink tabular-nums">
        {cr.timeImpactDays} {cr.timeImpactDays === 1 ? "day" : "days"} claimed
      </span>
      <span className="tabular-nums">
        {cr.daysAwarded === null
          ? "Not yet awarded"
          : `${cr.daysAwarded} ${cr.daysAwarded === 1 ? "day" : "days"} awarded`}
      </span>
      {cr.delays.length > 0 ? (
        <span>
          {cr.delays.length} {cr.delays.length === 1 ? "delay" : "delays"} cited
        </span>
      ) : null}
    </>
  );
}

TimeClaimFigures.displayName = "TimeClaimFigures";

export function ChangeRow({ cr, projectId, canManage, onOpen, onEdit, onDelete }: ChangeRowProps) {
  const isTimeClaim = cr.type === "eot_only";

  return (
    <Card padding="md" interactive className="flex items-center gap-4">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink">{cr.title}</p>
          <Badge tone={CHANGE_STATUS_META[cr.status].tone} size="sm">
            {CHANGE_STATUS_META[cr.status].label}
          </Badge>
          <ChangeTypeBadge type={cr.type} />
          {cr.contractId ? <ContractChip projectId={projectId} contractId={cr.contractId} /> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          {isTimeClaim ? (
            <TimeClaimFigures cr={cr} />
          ) : (
            <>
              <span className="font-medium text-ink tabular-nums">
                {formatWholeCurrency(cr.costImpact, cr.currency)}
              </span>
              {cr.timeImpactDays > 0 ? <span>+{cr.timeImpactDays} days</span> : null}
            </>
          )}
          {cr.commentCount > 0 ? (
            <span>
              {cr.commentCount} comment{cr.commentCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </button>
      {canManage ? (
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

ChangeRow.displayName = "ChangeRow";
