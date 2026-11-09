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
import { formatDateTime, formatTimeAgo } from "@/lib/formatters";
import type { LedgerEntry, LedgerEntryType } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon, ClockAlertIcon, PaperclipIcon, StackIcon } from "./icons";
import { ENTRY_TYPE_META, formatMeasure } from "./shared";

/**
 * The stock ledger as a register: one row per movement, in the order the
 * ledger recorded them. It is append-only, so a voided entry is never hidden —
 * it stays legible, struck through and tagged.
 */

const COLUMN_COUNT = 6;

const HEADER_CELL_CLASS = "px-6 py-4 text-caption-l! font-medium normal-case text-[#4D4D4D]";

const TYPE_BADGE_CLASS: Record<LedgerEntryType, string> = {
  IN: "border-transparent bg-[#E7F8EE] text-[#00A63E]",
  USED: "border-transparent bg-[#E4ECFF] text-[#004DE7]",
  VOID: "border-[#EBEBEB] bg-white text-[#1E1E1E]",
};

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
    <div className="mt-4 overflow-hidden border border-[#EBEBEB] bg-white">
      <Table className="min-w-[960px] table-fixed">
        <TableHead className="bg-[#F0F0F0]">
          <tr>
            <TableHeaderCell className={cn(HEADER_CELL_CLASS, "w-[29%]")}>Material</TableHeaderCell>
            <TableHeaderCell className={cn(HEADER_CELL_CLASS, "w-[14%]")}>Status</TableHeaderCell>
            <TableHeaderCell className={cn(HEADER_CELL_CLASS, "w-[17%]")}>Date</TableHeaderCell>
            <TableHeaderCell className={cn(HEADER_CELL_CLASS, "w-[19%]")}>Logged by</TableHeaderCell>
            <TableHeaderCell className={cn(HEADER_CELL_CLASS, "w-[17%]")}>Photo</TableHeaderCell>
            <TableHeaderCell align="right" className={cn(HEADER_CELL_CLASS, "w-[4%] min-w-[96px]")}>
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

/** Everything the row's columns no longer show, kept one hover away. */
function detailTitle(entry: LedgerEntry): string {
  return [
    entry.supplier ? `Supplier: ${entry.supplier}` : null,
    entry.deliveryNote ? `Delivery note: ${entry.deliveryNote}` : null,
    entry.locationKey ? `Location: ${entry.locationKey}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function LedgerTableRow({ entry, canManage, approving, onVoid, onApprove }: RowProps) {
  const meta = ENTRY_TYPE_META[entry.entryType];
  const isPending = entry.approvalStatus === "Pending";
  const isVoided = entry.status === "Voided";
  const isReversal = entry.entryType === "VOID";
  const photo = entry.files[0];

  return (
    <TableRow className={cn("align-middle", isVoided && "bg-surface-alt")}>
      <TableCell className="px-6 py-4 text-caption-l!" title={detailTitle(entry) || undefined}>
        <p className={cn("truncate font-medium text-[#1E1E1E]", isVoided && "line-through decoration-gray-400")}>
          {entry.materialName}
        </p>
        <p className="mt-0.5 truncate text-caption-m! text-gray-500">
          {formatMeasure(entry.quantity, entry.unit)}
          {entry.stageName ? ` · ${entry.stageName}` : ""}
        </p>
        {entry.reason ? (
          <p className="mt-0.5 text-caption-m! text-gray-500">
            <span className="font-medium text-gray-700">{reasonLabel(entry)}:</span> {entry.reason}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="px-6 py-4">
        <EntryStatusCell entry={entry} label={meta.label} />
      </TableCell>
      <TableCell className="whitespace-nowrap px-6 py-4 text-caption-l! text-[#1E1E1E]">
        <time dateTime={entry.occurredAt} title={formatDateTime(entry.occurredAt)}>
          {formatTimeAgo(entry.occurredAt)}
        </time>
      </TableCell>
      <TableCell className="truncate px-6 py-4 text-caption-l! text-[#1E1E1E]">
        {entry.loggedByName ?? "Unknown user"}
      </TableCell>
      <TableCell className="px-6 py-4 text-caption-l!">
        {photo ? (
          <a
            href={photo.url}
            target="_blank"
            rel="noreferrer"
            title={photo.name}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex max-w-full items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <PaperclipIcon className="size-3.5 shrink-0" />
            <span className="truncate">{photo.name}</span>
          </a>
        ) : null}
      </TableCell>
      <TableCell align="right" className="px-6 py-4">
        <div className="flex items-center justify-end gap-1">
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
 * The movement type, plus anything the entry is waiting on or flagged for.
 * Every flag carries a glyph and a label, never colour alone (WCAG 1.4.1);
 * a settled, unflagged entry shows the type alone.
 */
function EntryStatusCell({ entry, label }: { entry: LedgerEntry; label: string }) {
  const isPending = entry.approvalStatus === "Pending";

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={cn(
          "inline-flex h-6 items-center rounded-full border px-2.5 text-caption-m! font-medium",
          TYPE_BADGE_CLASS[entry.entryType],
        )}
      >
        {label}
      </span>
      {isPending ? (
        <Badge dot tone="warning" size="sm">
          Awaiting approval
        </Badge>
      ) : null}
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
    </div>
  );
}

EntryStatusCell.displayName = "EntryStatusCell";
