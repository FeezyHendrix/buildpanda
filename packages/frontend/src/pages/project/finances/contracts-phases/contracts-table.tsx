import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
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
import { RowActionIcon } from "@/components/molecules/row-action-icon";
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import type { Contract } from "@/hooks/use-contracts";
import { formatCurrency } from "@/lib/formatters";
import type { Currency } from "@/lib/project-types";
import { CONTRACT_STATUS_META, contractSubtitle, formatSignedDateLong, isPlaceholderContract } from "./contract-model";

/**
 * The contract register. Every row is a recorded agreement, never a payment.
 * Status is read here and changed in the edit drawer, where the "needs the
 * signed document" rule has room to explain itself.
 */

const COLUMN_COUNT = 6;
const HEADER_CELL = "h-[52px] px-[24px] py-0 text-caption-l font-medium normal-case text-[#525252]";
const BODY_CELL = "px-[24px] py-0 text-caption-l text-[#1E1E1E]";

/** Column widths as shares of the 1117px design table. */
const COLUMN_WIDTHS = ["22.1%", "19.4%", "21.1%", "14.8%", "16.7%", "5.9%"] as const;

interface ContractsTableProps {
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
    <div className="border border-[#EEEEEE] bg-white">
      <Table className="min-w-[860px] table-fixed">
        <colgroup>
          {COLUMN_WIDTHS.map((width) => (
            <col key={width} style={{ width }} />
          ))}
        </colgroup>
        <TableHead>
          <tr>
            <TableHeaderCell className={HEADER_CELL}>Contract ID</TableHeaderCell>
            <TableHeaderCell className={HEADER_CELL}>Status</TableHeaderCell>
            <TableHeaderCell className={HEADER_CELL}>Signed Date</TableHeaderCell>
            <TableHeaderCell className={HEADER_CELL}>Phases</TableHeaderCell>
            <TableHeaderCell className={HEADER_CELL}>Total</TableHeaderCell>
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
  currency: Currency;
  contract: Contract;
  canManage: boolean;
  onView: (contract: Contract) => void;
  onEdit: (contract: Contract) => void;
  onDelete: (contract: Contract) => void;
}

function ContractRow({ currency, contract, canManage, onView, onEdit, onDelete }: ContractRowProps) {
  const placeholder = isPlaceholderContract(contract);
  const status = CONTRACT_STATUS_META[contract.status];
  const actions = useMemo<RowActionItem[]>(
    () => [
      { label: "View", icon: <RowActionIcon name="view" />, onSelect: () => onView(contract) },
      ...(canManage && !placeholder ? [{ label: "Edit", icon: <RowActionIcon name="edit" />, onSelect: () => onEdit(contract) }] : []),
      ...(canManage && !placeholder && contract.kind !== "main"
        ? [{ label: "Delete", icon: <RowActionIcon name="delete" />, tone: "danger" as const, onSelect: () => onDelete(contract) }]
        : []),
    ],
    [contract, canManage, placeholder, onView, onEdit, onDelete],
  );

  return (
    <TableRow onClick={() => onView(contract)} className="h-[52px] border-[#EEEEEE]">
      <TableCell className={BODY_CELL}>
        <p className="truncate">{contract.title}</p>
        <p className="truncate text-caption-m text-[#737373]">{contractSubtitle(contract)}</p>
      </TableCell>
      <TableCell className={BODY_CELL}>
        <Badge tone={status.tone} size="sm" className="text-caption-m font-medium">
          {status.label}
        </Badge>
      </TableCell>
      <TableCell className={`${BODY_CELL} whitespace-nowrap`}>{formatSignedDateLong(contract.signedAt)}</TableCell>
      <TableCell className={`${BODY_CELL} tabular-nums`}>{contract.phaseCount}</TableCell>
      <TableCell className={`${BODY_CELL} whitespace-nowrap tabular-nums`}>{formatCurrency(contract.total, currency)}</TableCell>
      <TableCell className={BODY_CELL} onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-center">
          <RowActionsMenu ariaLabel={`Actions for ${contract.title}`} items={actions} appearance="house" />
        </div>
      </TableCell>
    </TableRow>
  );
}

ContractRow.displayName = "ContractRow";
