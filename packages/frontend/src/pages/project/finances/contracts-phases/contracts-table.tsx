import { useMemo } from "react";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
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
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import type { Contract } from "@/hooks/use-contracts";
import { formatCurrency } from "@/lib/formatters";
import type { Currency } from "@/lib/project-types";
import { CONTRACT_KIND_LABEL, formatSignedDate, isPlaceholderContract } from "./contract-model";
import { ContractStatusSelect } from "./contract-status-select";

/** The contract register. Every row is a recorded agreement, never a payment. */

const COLUMN_COUNT = 8;

interface ContractsTableProps {
  projectId: string;
  currency: Currency;
  contracts: Contract[];
  isLoading: boolean;
  isFiltered: boolean;
  canManage: boolean;
  onView: (contract: Contract) => void;
  onEdit: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
  onAdd?: () => void;
}

export function ContractsTable({
  projectId,
  currency,
  contracts,
  isLoading,
  isFiltered,
  canManage,
  onView,
  onEdit,
  onDelete,
  onAdd,
}: ContractsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[960px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Contract ID</TableHeaderCell>
            <TableHeaderCell align="right">Phases</TableHeaderCell>
            <TableHeaderCell>Signed date</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Trade</TableHeaderCell>
            <TableHeaderCell>Legal entity</TableHeaderCell>
            <TableHeaderCell align="right">Total</TableHeaderCell>
            <TableHeaderCell align="right" className="w-[72px]">
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
          ) : contracts.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <EmptyState
                variant="inline"
                icon={<FinancesIcon />}
                title={isFiltered ? "No contracts match" : "No contracts yet"}
                description={
                  isFiltered
                    ? "Try another contract, trade or legal entity."
                    : "Add the main contract, then one per executed change order, to price the phases of this build."
                }
                action={!isFiltered && canManage && onAdd ? { label: "Add contract", onClick: onAdd } : undefined}
              />
            </TableEmptyRow>
          ) : (
            contracts.map((contract) => (
              <ContractRow
                key={contract.id}
                projectId={projectId}
                currency={currency}
                contract={contract}
                canManage={canManage}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

ContractsTable.displayName = "ContractsTable";

interface ContractRowProps {
  projectId: string;
  currency: Currency;
  contract: Contract;
  canManage: boolean;
  onView: (contract: Contract) => void;
  onEdit: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
}

function ContractRow({ projectId, currency, contract, canManage, onView, onEdit, onDelete }: ContractRowProps) {
  const placeholder = isPlaceholderContract(contract);
  const actions = useMemo<RowActionItem[]>(
    () => [
      { label: "View", onSelect: () => onView(contract) },
      ...(canManage && !placeholder ? [{ label: "Edit", onSelect: () => onEdit(contract) }] : []),
      ...(canManage && !placeholder && contract.kind !== "main"
        ? [{ label: "Delete", tone: "danger" as const, onSelect: () => onDelete(contract) }]
        : []),
    ],
    [contract, canManage, placeholder, onView, onEdit, onDelete],
  );

  return (
    <TableRow onClick={() => onView(contract)}>
      <TableCell>
        <p className="font-medium text-ink">{contract.title}</p>
        <p className="text-xs text-ink-muted">{CONTRACT_KIND_LABEL[contract.kind]}</p>
      </TableCell>
      <TableCell align="right" className="tabular-nums">{contract.phaseCount}</TableCell>
      <TableCell className="whitespace-nowrap">{formatSignedDate(contract.signedAt)}</TableCell>
      <TableCell>
        <ContractStatusSelect projectId={projectId} contract={contract} disabled={!canManage} />
      </TableCell>
      <TableCell>{contract.trade ?? "—"}</TableCell>
      <TableCell>{contract.legalEntity ?? "—"}</TableCell>
      <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums">
        {formatCurrency(contract.total, currency)}
      </TableCell>
      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <RowActionsMenu ariaLabel={`Actions for ${contract.title}`} items={actions} />
        </div>
      </TableCell>
    </TableRow>
  );
}

ContractRow.displayName = "ContractRow";
