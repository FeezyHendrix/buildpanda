import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatShortDate } from "@/lib/formatters";
import type { EotClaim } from "@/api/extensions-of-time";
import { EOT_STATUS_META } from "./eot-meta";

const COLUMN_COUNT = 7;

interface EotTableProps {
  claims: EotClaim[];
  totalCount: number;
  isPending: boolean;
  canManage: boolean;
  /** userId -> display name, so "decided by" is a person and not an id. */
  namesById: ReadonlyMap<string, string>;
  onEdit: (claim: EotClaim) => void;
  onSubmit: (claim: EotClaim) => void;
  onDecide: (claim: EotClaim) => void;
}

function ClaimRow({
  claim,
  canManage,
  namesById,
  onEdit,
  onSubmit,
  onDecide,
}: {
  claim: EotClaim;
  canManage: boolean;
  namesById: ReadonlyMap<string, string>;
  onEdit: () => void;
  onSubmit: () => void;
  onDecide: () => void;
}) {
  const status = EOT_STATUS_META[claim.status];
  const decidedBy = claim.decidedById ? (namesById.get(claim.decidedById) ?? "—") : null;
  const isDecided = claim.status === "Approved" || claim.status === "Rejected";

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-medium text-ink">{claim.reference}</TableCell>
      <TableCell>
        <p className="font-medium text-ink">{claim.title}</p>
        {claim.delays.length > 0 ? (
          <p className="mt-0.5 text-xs text-ink-muted">
            {claim.delays.length} {claim.delays.length === 1 ? "delay" : "delays"} cited
          </p>
        ) : null}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {claim.daysClaimed}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">
        {claim.daysAwarded === null ? "—" : claim.daysAwarded}
      </TableCell>
      <TableCell>
        <Badge dot tone={status.tone} size="sm">
          {status.glyph} {status.label}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-ink-muted">
        {decidedBy ? (
          <>
            {decidedBy}
            {claim.decidedAt ? (
              <p className="mt-0.5">{formatShortDate(claim.decidedAt)}</p>
            ) : null}
          </>
        ) : claim.submittedAt ? (
          `Submitted ${formatShortDate(claim.submittedAt)}`
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell align="right">
        {canManage ? (
          <div className="flex items-center justify-end gap-1">
            {claim.status === "Draft" ? (
              <Button type="button" variant="secondary" size="sm" onClick={onSubmit}>
                Submit
              </Button>
            ) : null}
            {claim.status === "Submitted" ? (
              <Button type="button" variant="primary" size="sm" onClick={onDecide}>
                Decide
              </Button>
            ) : null}
            {isDecided ? null : (
              <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
                Edit
              </Button>
            )}
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

ClaimRow.displayName = "ClaimRow";

/** The EOT register: what was claimed, what was awarded, and who decided it. */
export function EotTable({
  claims,
  totalCount,
  isPending,
  canManage,
  namesById,
  onEdit,
  onSubmit,
  onDecide,
}: EotTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[880px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Claim</TableHeaderCell>
            <TableHeaderCell>Title</TableHeaderCell>
            <TableHeaderCell align="right">Days claimed</TableHeaderCell>
            <TableHeaderCell align="right">Days awarded</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Decided</TableHeaderCell>
            <TableHeaderCell align="right" />
          </tr>
        </TableHead>
        <TableBody>
          {isPending ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <div className="flex justify-center py-10">
                <Spinner size="md" />
              </div>
            </TableEmptyRow>
          ) : claims.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <EmptyState
                variant="inline"
                icon={<CalendarIcon />}
                title={totalCount === 0 ? "No claims raised" : "No claims match this filter"}
                description={
                  totalCount === 0
                    ? "Raise a claim from the delays that are not the contractor's risk to move the completion date."
                    : "Try a different status filter."
                }
              />
            </TableEmptyRow>
          ) : (
            claims.map((claim) => (
              <ClaimRow
                key={claim.id}
                claim={claim}
                canManage={canManage}
                namesById={namesById}
                onEdit={() => onEdit(claim)}
                onSubmit={() => onSubmit(claim)}
                onDecide={() => onDecide(claim)}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

EotTable.displayName = "EotTable";
