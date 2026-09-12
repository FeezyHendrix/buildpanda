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
      <TableCell className="whitespace-nowrap">{formatDayMonth(tx.transactedAt)}</TableCell>
      <TableCell>
        <div className="font-medium text-gray-900">{tx.title}</div>
        {tx.description ? (
          <div className="text-xs text-gray-500 line-clamp-1 max-w-[200px] mt-0.5">{tx.description}</div>
        ) : null}
        {tx.reference ? <div className="text-xs text-gray-400 mt-0.5">Ref: {tx.reference}</div> : null}
      </TableCell>
      <TableCell>
        <CategoryBadge categoryLabel={tx.categoryLabel} categoryColor={tx.categoryColor} />
      </TableCell>
      <TableCell>{tx.vendor || "—"}</TableCell>
      <TableCell align="right" className="font-medium text-gray-900 tabular-nums">
        {formatCurrency(tx.amount, currency)}
      </TableCell>
      <TableCell className="text-xs">{tx.createdByName || "Unknown"}</TableCell>
      <TableCell align="right">
        <Button
          variant="ghost"
          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 px-2"
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
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Details</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell>Vendor</TableHeaderCell>
              <TableHeaderCell align="right">Amount</TableHeaderCell>
              <TableHeaderCell>Logged by</TableHeaderCell>
              <TableHeaderCell className="w-[100px]" />
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
