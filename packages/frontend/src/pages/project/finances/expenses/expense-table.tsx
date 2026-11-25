import { Badge } from "@/components/atoms/badge";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { RowActionsMenu } from "@/components/molecules/row-actions-menu";
import { formatCurrency, formatLongDate } from "@/lib/formatters";
import type { Transaction } from "@/lib/project-types";
import { CategoryBadge } from "./category-badge";

const COLUMNS = ["Title", "Category", "Date", "Vendor", "Amount"] as const;
const COLUMN_COUNT = COLUMNS.length + 1;
const HEADER_CELL = "h-[52px] px-[24px] py-0 text-caption-l font-medium normal-case text-[#525252]";
const BODY_CELL = "px-[24px] py-0 text-caption-l text-[#1E1E1E]";

/** Column widths as shares of the 1116px design table. */
const COLUMN_WIDTHS = ["18.1%", "20.2%", "17.7%", "21.4%", "16.4%", "6.2%"] as const;

/**
 * A credit and a recoverable deposit change how the amount reads, so they stay
 * visible beside the reference even though the table has no column for them.
 */
function ExpenseFlags({ tx }: { tx: Transaction }) {
  if (!tx.credit && !tx.recoverable) return null;
  return (
    <>
      {tx.credit ? (
        <Badge tone="success" size="sm" dot>
          Credit
        </Badge>
      ) : null}
      {tx.recoverable ? (
        <Badge tone="info" size="sm" dot>
          Recoverable
        </Badge>
      ) : null}
    </>
  );
}

ExpenseFlags.displayName = "ExpenseFlags";

interface ExpenseRowProps {
  tx: Transaction;
  currency: string;
  onOpen: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

function ExpenseRow({ tx, currency, onOpen, onDelete }: ExpenseRowProps) {
  return (
    <TableRow onClick={() => onOpen(tx)} className="h-[68px] border-[#EEEEEE]">
      <TableCell className={BODY_CELL}>
        <p className="truncate">{tx.title}</p>
        <div className="flex min-w-0 items-center gap-[6px]">
          {tx.reference ? <p className="truncate text-caption-m text-[#737373]">Ref: {tx.reference}</p> : null}
          <ExpenseFlags tx={tx} />
        </div>
      </TableCell>
      <TableCell className={BODY_CELL}>
        <CategoryBadge categoryLabel={tx.categoryLabel} categoryColor={tx.categoryColor} />
      </TableCell>
      <TableCell className={`${BODY_CELL} whitespace-nowrap`}>{formatLongDate(tx.transactedAt)}</TableCell>
      <TableCell className={BODY_CELL}>
        <p className="truncate">{tx.vendor || "—"}</p>
      </TableCell>
      <TableCell className={`${BODY_CELL} whitespace-nowrap tabular-nums`}>
        {tx.credit ? "−" : ""}
        {formatCurrency(tx.amount, currency)}
      </TableCell>
      <TableCell className={BODY_CELL} onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-center">
          <RowActionsMenu ariaLabel={`Actions for ${tx.title}`} onEdit={() => onOpen(tx)} onDelete={() => onDelete(tx)} />
        </div>
      </TableCell>
    </TableRow>
  );
}

ExpenseRow.displayName = "ExpenseRow";

interface ExpenseTableProps {
  transactions: Transaction[];
  currency: string;
  isLoading: boolean;
  isFiltered: boolean;
  onOpen: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onRecord: () => void;
  onClearFilters: () => void;
}

export function ExpenseTable({ transactions, currency, isLoading, isFiltered, onOpen, onDelete, onRecord, onClearFilters }: ExpenseTableProps) {
  return (
    <div className="border border-[#EEEEEE] bg-white">
      <Table className="min-w-[900px] table-fixed">
        <colgroup>
          {COLUMN_WIDTHS.map((width) => (
            <col key={width} style={{ width }} />
          ))}
        </colgroup>
        <TableHead>
          <tr>
            {COLUMNS.map((column) => (
              <TableHeaderCell key={column} className={HEADER_CELL}>
                {column}
              </TableHeaderCell>
            ))}
            <TableHeaderCell className={HEADER_CELL}>
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
          ) : transactions.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <EmptyState
                variant="inline"
                icon={isFiltered ? undefined : <FinancesIcon />}
                title={isFiltered ? "No expenses match these filters" : "No expenses recorded yet"}
                description={isFiltered ? "Try adjusting your search or filters." : "Start recording site spend to build your log."}
                action={isFiltered ? { label: "Clear filters", onClick: onClearFilters } : { label: "Record expense", onClick: onRecord }}
              />
            </TableEmptyRow>
          ) : (
            transactions.map((tx) => <ExpenseRow key={tx.id} tx={tx} currency={currency} onOpen={onOpen} onDelete={onDelete} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}

ExpenseTable.displayName = "ExpenseTable";
