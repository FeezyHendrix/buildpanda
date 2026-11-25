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
import { RowActionIcon } from "@/components/molecules/row-action-icon";
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import type { Contract } from "@/hooks/use-contracts";
import { useUpdateStage } from "@/hooks/use-stages";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import type { Currency, Stage } from "@/lib/project-types";
import { toast } from "@/lib/toast";
import { contractOfStage } from "./contract-model";
import { EditableNumberCell } from "./editable-number-cell";

/**
 * Phases with what each is expected to cost and what it has cost so far. The
 * estimates are typed in place; the used figures are read from expenses and
 * purchase orders, never edited here.
 */

const COLUMN_COUNT = 6;
const DASH = "—";
const HEADER_CELL = "h-[52px] px-[24px] py-0 text-caption-l font-medium normal-case text-[#525252]";
const BODY_CELL = "whitespace-nowrap px-[24px] py-0 text-caption-l text-[#1E1E1E] tabular-nums";
/** Column widths as shares of the 1117px design table. */
const COLUMN_WIDTHS = ["17.5%", "22.2%", "22.2%", "15.5%", "16.7%", "5.9%"] as const;

type EstimateField = "expectedCost" | "estimatedLaborHours" | "laborBudget" | "materialBudget";

interface PhasesTableProps {
  projectId: string;
  currency: Currency;
  stages: Stage[];
  contracts: Contract[];
  mainContract: Contract;
  isLoading: boolean;
  isFiltered: boolean;
  canManage: boolean;
  onView: (stage: Stage) => void;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
}

export function PhasesTable({
  projectId,
  currency,
  stages,
  contracts,
  mainContract,
  isLoading,
  isFiltered,
  canManage,
  onView,
  onEditValue,
  onOpenSchedule,
}: PhasesTableProps) {
  const update = useUpdateStage();

  function commit(stage: Stage, field: EstimateField, value: number | null): void {
    update.mutate(
      { projectId, stageId: stage.id, [field]: value },
      { onError: (error) => toast(getApiErrorMessage(error, "Could not save the estimate"), "error") },
    );
  }

  return (
    <div className="border border-[#EEEEEE] bg-white">
      <Table className="min-w-[960px] table-fixed">
        <colgroup>
          {COLUMN_WIDTHS.map((width) => (
            <col key={width} style={{ width }} />
          ))}
        </colgroup>
        <TableHead>
          <tr>
            <TableHeaderCell className={HEADER_CELL}>Phase</TableHeaderCell>
            <TableHeaderCell className={HEADER_CELL}>Schedule value</TableHeaderCell>
            <TableHeaderCell className={HEADER_CELL} title="Click a cell to edit">Est. total costs</TableHeaderCell>
            <TableHeaderCell className={HEADER_CELL} title="Click a cell to edit">Est. labour hours</TableHeaderCell>
            <TableHeaderCell className={HEADER_CELL}>Total costs</TableHeaderCell>
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
          ) : stages.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <EmptyState
                variant="inline"
                icon={<FinancesIcon />}
                title={isFiltered ? "No phases match" : "No phases on this build yet"}
                description={
                  isFiltered ? "Try another phase name." : "Phases come from the build plan; once they exist you can price and estimate them here."
                }
              />
            </TableEmptyRow>
          ) : (
            stages.map((stage) => (
              <PhaseRow
                key={stage.id}
                stage={stage}
                contract={contractOfStage(stage, contracts, mainContract)}
                currency={currency}
                canManage={canManage}
                saving={update.isPending && update.variables?.stageId === stage.id}
                onCommit={commit}
                onView={onView}
                onEditValue={onEditValue}
                onOpenSchedule={onOpenSchedule}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

PhasesTable.displayName = "PhasesTable";

interface PhaseRowProps {
  stage: Stage;
  contract: Contract;
  currency: Currency;
  canManage: boolean;
  saving: boolean;
  onCommit: (stage: Stage, field: EstimateField, value: number | null) => void;
  onView: (stage: Stage) => void;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
}

function money(value: number | null | undefined, currency: Currency): string {
  return value == null ? DASH : formatCurrency(value, currency);
}

function hours(value: number | null | undefined): string {
  return value == null ? DASH : `${value.toLocaleString("en-GB")} ${value === 1 ? "hour" : "hours"}`;
}

function PhaseRow({ stage, contract, currency, canManage, saving, onCommit, onView, onEditValue, onOpenSchedule }: PhaseRowProps) {
  const actions = useMemo<RowActionItem[]>(
    () => [
      { label: "View Phase", icon: <RowActionIcon name="view" />, onSelect: () => onView(stage) },
      ...(canManage ? [{ label: "Edit Value", icon: <RowActionIcon name="edit" />, onSelect: () => onEditValue(stage) }] : []),
      { label: canManage ? "Schedule" : "View Schedule", icon: <RowActionIcon name="schedule" />, onSelect: () => onOpenSchedule(stage) },
    ],
    [stage, canManage, onView, onEditValue, onOpenSchedule],
  );

  return (
    <TableRow onClick={() => onView(stage)} className="h-[52px] border-[#EEEEEE]">
      <TableCell className={BODY_CELL}>
        <p className="truncate">{stage.name}</p>
        <p className="truncate text-caption-m text-[#737373]">{contract.title}</p>
      </TableCell>
      <TableCell className={BODY_CELL}>
        {stage.value > 0 ? formatCurrency(stage.value, currency) : <span className="text-[#737373]">Not priced</span>}
      </TableCell>
      <TableCell className={BODY_CELL}>
        <EditableNumberCell
          value={stage.expectedCost}
          display={money(stage.expectedCost, currency)}
          editable={canManage}
          saving={saving}
          ariaLabel={`Estimated total cost of ${stage.name}`}
          onCommit={(value) => onCommit(stage, "expectedCost", value)}
        />
      </TableCell>
      <TableCell className={BODY_CELL}>
        <EditableNumberCell
          value={stage.estimatedLaborHours}
          display={hours(stage.estimatedLaborHours)}
          editable={canManage}
          saving={saving}
          ariaLabel={`Estimated labour hours of ${stage.name}`}
          onCommit={(value) => onCommit(stage, "estimatedLaborHours", value)}
        />
      </TableCell>
      <TableCell className={BODY_CELL}>{money(stage.totalCost, currency)}</TableCell>
      <TableCell className={BODY_CELL} onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-center">
          <RowActionsMenu ariaLabel={`Actions for ${stage.name}`} items={actions} appearance="house" />
        </div>
      </TableCell>
    </TableRow>
  );
}

PhaseRow.displayName = "PhaseRow";
