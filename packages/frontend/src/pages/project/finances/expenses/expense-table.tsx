import { Button } from "@/components/atoms/button";
import { Card } from "@/components/atoms/card";
import { Spinner } from "@/components/atoms/spinner";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { EmptyState } from "@/components/molecules/empty-state";
import { formatCurrency, formatDayMonth } from "@/lib/formatters";
import type { Transaction } from "@/lib/project-types";
import { CategoryBadge } from "./expense-dialogs";

const HEAD_CELL = "px-4 py-3 font-medium";

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
    <tr className="group hover:bg-gray-50/50 cursor-pointer" onClick={() => onOpen(tx)}>
      <td className="px-4 py-4 whitespace-nowrap">{formatDayMonth(tx.transactedAt)}</td>
      <td className="px-4 py-4">
        <div className="font-medium text-gray-900">{tx.title}</div>
        {tx.description ? (
          <div className="text-xs text-gray-500 line-clamp-1 max-w-[200px] mt-0.5">{tx.description}</div>
        ) : null}
        {tx.reference ? <div className="text-xs text-gray-400 mt-0.5">Ref: {tx.reference}</div> : null}
      </td>
      <td className="px-4 py-4">
        <CategoryBadge categoryLabel={tx.categoryLabel} categoryColor={tx.categoryColor} />
      </td>
      <td className="px-4 py-4">{tx.vendor || "—"}</td>
      <td className="px-4 py-4 text-right font-medium text-gray-900 tabular-nums">
        {formatCurrency(tx.amount, currency)}
      </td>
      <td className="px-4 py-4 text-xs">{tx.createdByName || "Unknown"}</td>
      <td className="px-4 py-4 text-right">
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
      </td>
    </tr>
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-gray-500">
              <tr>
                <th className={HEAD_CELL}>Date</th>
                <th className={HEAD_CELL}>Details</th>
                <th className={HEAD_CELL}>Category</th>
                <th className={HEAD_CELL}>Vendor</th>
                <th className={`${HEAD_CELL} text-right`}>Amount</th>
                <th className={HEAD_CELL}>Logged by</th>
                <th className={`${HEAD_CELL} w-[100px]`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <ExpenseRow key={tx.id} tx={tx} currency={currency} onOpen={onOpen} onDelete={onDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

ExpenseTable.displayName = "ExpenseTable";
