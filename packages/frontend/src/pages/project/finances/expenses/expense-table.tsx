import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatCurrency, formatDayMonth } from "@/lib/formatters";
import type { Transaction } from "@/lib/project-types";
import { CategoryBadge } from "./expense-dialogs";

function ExpenseRow({
  tx,
  currency,
  onOpen,
  onDelete,
}: {
  tx: Transaction;
  currency: string;
  onOpen: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  return (
    <TableRow className="group" onClick={() => onOpen(tx)}>
      <TableCell>
        <div className="font-medium text-ink">{tx.title}</div>
        {tx.vendor ? <div className="mt-0.5 text-xs text-ink-muted">{tx.vendor}</div> : null}
        {tx.reference ? <div className="mt-0.5 text-xs text-ink-muted">Ref: {tx.reference}</div> : null}
      </TableCell>
      <TableCell>
        <CategoryBadge categoryLabel={tx.categoryLabel} categoryColor={tx.categoryColor} />
      </TableCell>
      <TableCell className="whitespace-nowrap">{formatDayMonth(tx.transactedAt)}</TableCell>
      <TableCell className="whitespace-nowrap text-ink-muted">—</TableCell>
      <TableCell className="text-ink-subtle">{tx.stageName || "—"}</TableCell>
      <TableCell align="right" className="font-medium text-ink tabular-nums">
        {formatCurrency(tx.amount, currency)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-ink-subtle">
        {formatDayMonth(tx.createdAt)}
        {tx.createdByName ? <span className="text-ink-muted"> · {tx.createdByName}</span> : null}
      </TableCell>
      <TableCell align="right">
        <Button
          variant="danger"
          size="sm"
          className="opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(tx);
          }}
        >
          Delete
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function ExpenseTable({
  transactions,
  currency,
  isLoading,
  isFiltered,
  onOpen,
  onDelete,
  onRecord,
  onClearFilters,
}: {
  transactions: Transaction[];
  currency: string;
  isLoading: boolean;
  isFiltered: boolean;
  onOpen: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  onRecord: () => void;
  onClearFilters: () => void;
}) {
  return (
    <Card className="bg-white overflow-hidden">
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner size="md" />
        </div>
      ) : transactions.length === 0 && !isFiltered ? (
        <EmptyState
          icon={<FinancesIcon />}
          title="No expenses recorded yet"
          description="Start recording site spend to build your log."
          action={{ label: "Record expense", onClick: onRecord }}
        />
      ) : transactions.length === 0 ? (
        <EmptyState
          title="No expenses match these filters"
          description="Try adjusting your filters."
          action={{ label: "Clear filters", onClick: onClearFilters }}
        />
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>From</TableHeaderCell>
              <TableHeaderCell title="Expenses are logged on a single date">To</TableHeaderCell>
              <TableHeaderCell>Stage</TableHeaderCell>
              <TableHeaderCell align="right">Amount</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell className="w-[100px]">
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {transactions.map((tx) => (
              <ExpenseRow key={tx.id} tx={tx} currency={currency} onOpen={onOpen} onDelete={onDelete} />
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

ExpenseTable.displayName = "ExpenseTable";
