import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
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
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import { formatDateTime, formatShortDate, formatTimeAgo } from "@/lib/formatters";
import type { LedgerEntry } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon, ClockAlertIcon, PaperclipIcon, StackIcon } from "./icons";
import { ENTRY_TYPE_META, signedMeasure } from "./shared";

/**
 * The stock ledger as a register: one row per movement, in the order the
 * ledger recorded them. It is append-only, so a voided entry is never hidden —
 * it stays legible, struck through and tagged.
 */

const COLUMN_COUNT = 8;

/**
 * `reason` carries whatever explains the movement, so the label has to match
 * the movement rather than assume the worst: only a voided entry is explained
 * by a void reason. A live receipt's free text is a note, and it is never the
 * delivery note — that has a column and a label of its own.
 */
function reasonLabel(entry: LedgerEntry): string {
  if (entry.entryType === "VOID") return "Reversal reason";
  if (entry.status === "Voided") return "Void reason";
  return "Note";
}

interface LedgerTableProps {
  entries: LedgerEntry[];
  /** True when the ledger has entries but the filters hide them all. */
  isFiltered: boolean;
  isLoading: boolean;
  canManage: boolean;
  approvingId?: string | null;
  onVoid: (entry: LedgerEntry) => void;
  onApprove: (entry: LedgerEntry) => void;
  onClearFilters: () => void;
}

export function LedgerTable({
  entries,
  isFiltered,
  isLoading,
  canManage,
  approvingId,
  onVoid,
  onApprove,
  onClearFilters,
}: LedgerTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[1080px]">
        <TableHead>
          <tr>
            <TableHeaderCell className="whitespace-nowrap">Date</TableHeaderCell>
            <TableHeaderCell>Material</TableHeaderCell>
            <TableHeaderCell align="right" className="whitespace-nowrap">
              In / out
            </TableHeaderCell>
            <TableHeaderCell>Location</TableHeaderCell>
            <TableHeaderCell>Supplier</TableHeaderCell>
            <TableHeaderCell className="whitespace-nowrap">Logged by</TableHeaderCell>
            <TableHeaderCell>Approval</TableHeaderCell>
            <TableHeaderCell align="right" className="w-[120px]">
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableEmptyRow colSpan={COLUMN_COUNT} className="py-12">
              <div className="flex items-center justify-center">
                <Spinner size="md" />
              </div>
            </TableEmptyRow>
          ) : entries.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              {isFiltered ? (
                <EmptyState
                  variant="inline"
                  title="No entries match these filters"
                  description="Nothing in the ledger falls under this view yet."
                  action={{ label: "Clear filters", onClick: onClearFilters }}
                />
              ) : (
                <EmptyState
                  variant="inline"
                  icon={<StackIcon />}
                  title="No ledger entries yet"
                  description="Every delivery received and every bag used gets recorded here, with who logged it and when."
                />
              )}
            </TableEmptyRow>
          ) : (
            entries.map((entry) => (
              <LedgerTableRow
                key={entry.id}
                entry={entry}
                canManage={canManage}
                approving={approvingId === entry.id}
                onVoid={onVoid}
                onApprove={onApprove}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

LedgerTable.displayName = "LedgerTable";

interface RowProps {
  entry: LedgerEntry;
  canManage: boolean;
  approving: boolean;
  onVoid: (entry: LedgerEntry) => void;
  onApprove: (entry: LedgerEntry) => void;
}

function LedgerTableRow({ entry, canManage, approving, onVoid, onApprove }: RowProps) {
  const meta = ENTRY_TYPE_META[entry.entryType];
  const isPending = entry.approvalStatus === "Pending";
  const isVoided = entry.status === "Voided";
  const isReversal = entry.entryType === "VOID";
  const photo = entry.files[0];

  return (
    <TableRow className={cn(isVoided && "bg-surface-alt")}>
      <TableCell className="whitespace-nowrap">
        <p className="font-medium">{formatShortDate(entry.occurredAt)}</p>
        <time
          dateTime={entry.occurredAt}
          title={formatDateTime(entry.occurredAt)}
          className="mt-0.5 block text-xs text-ink-muted"
        >
          {formatTimeAgo(entry.occurredAt)}
        </time>
      </TableCell>
      <TableCell>
        <p className={cn("font-medium text-ink", isVoided && "line-through decoration-gray-400")}>
          {entry.materialName}
        </p>
        {entry.stageName ? <p className="mt-0.5 text-xs text-ink-muted">{entry.stageName}</p> : null}
        {entry.reason ? (
          <p className="mt-0.5 text-xs text-ink-muted">
            <span className="font-medium text-gray-700">{reasonLabel(entry)}:</span>{" "}
            {entry.reason}
          </p>
        ) : null}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          <Badge tone={meta.tone} size="sm">
            <meta.Icon className="size-3" />
            {meta.label}
          </Badge>
          <span className={cn("font-semibold tabular-nums", isVoided && "line-through")}>
            {signedMeasure(entry)}
          </span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{entry.locationKey || "—"}</TableCell>
      <TableCell>
        <p>{entry.supplier ?? "—"}</p>
        {entry.deliveryNote ? (
          <p className="mt-0.5 text-xs text-ink-muted">
            <span className="font-medium text-gray-700">Delivery note:</span> {entry.deliveryNote}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap">{entry.loggedByName ?? "Unknown user"}</TableCell>
      <TableCell>
        <EntryStatusCell entry={entry} />
      </TableCell>
      <TableCell align="right">
        <div className="flex items-center justify-end gap-1">
          {photo ? (
            <a
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              title={photo.name}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-500 transition-colors hover:bg-primary-50"
            >
              <PaperclipIcon className="size-3.5" />
              Proof
            </a>
          ) : null}
          {canManage && isPending && !isVoided ? (
            <Button
              size="sm"
              loading={approving}
              onClick={() => onApprove(entry)}
              title={`Approve this ${meta.verb.toLowerCase()} so it counts toward stock`}
            >
              Approve
            </Button>
          ) : null}
          {canManage && !isVoided && !isReversal ? (
            <RowActionsMenu
              ariaLabel={`Actions for ${entry.materialName}`}
              items={[
                {
                  label: isPending ? "Reject…" : "Void…",
                  tone: "danger",
                  onSelect: () => onVoid(entry),
                },
              ]}
            />
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

LedgerTableRow.displayName = "LedgerTableRow";

/**
 * Approval state plus anything the entry is flagged for. Every flag carries a
 * glyph and a label, never colour alone (WCAG 1.4.1).
 */
function EntryStatusCell({ entry }: { entry: LedgerEntry }) {
  const isPending = entry.approvalStatus === "Pending";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge dot tone={isPending ? "warning" : "success"} size="sm">
        {isPending ? "Awaiting approval" : "Approved"}
      </Badge>
      {entry.selfApproved ? (
        <Badge tone="warning" size="sm" variant="outline" title="Approved by the person who logged it">
          Self approved
        </Badge>
      ) : null}
      {entry.status === "Voided" ? (
        <Badge tone="neutral" size="sm" variant="outline">
          Voided
        </Badge>
      ) : null}
      {entry.negativeStock ? (
        <Badge tone="danger" size="sm">
          <AlertTriangleIcon className="size-3" />
          Negative stock
        </Badge>
      ) : null}
      {entry.timestampSuspect ? (
        <Badge tone="warning" size="sm">
          <ClockAlertIcon className="size-3" />
          Time flagged
        </Badge>
      ) : null}
      {entry.approvedByName && !isPending ? (
        <p className="w-full text-xs text-ink-muted">by {entry.approvedByName}</p>
      ) : null}
    </div>
  );
}

EntryStatusCell.displayName = "EntryStatusCell";
