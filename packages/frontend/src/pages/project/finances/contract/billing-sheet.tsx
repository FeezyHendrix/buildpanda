import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { SearchInput } from "@/components/atoms/search-input";
import { Spinner } from "@/components/atoms/spinner";
import { Table, TableBody, TableEmptyRow, TableHead } from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { useContracts } from "@/hooks/use-contracts";
import { useProjectFinances, useStageCosts } from "@/hooks/use-finances";
import { useProjectScheduleOfValues, useReorderStages, useStages } from "@/hooks/use-stages";
import type { Currency, Stage } from "@/lib/project-types";
import { AddMonthButton } from "./add-month-button";
import { BillingSheetGroupEmpty, BillingSheetGroupHeader } from "./billing-sheet-group";
import { BillingSheetHeader, BillingSheetTotals } from "./billing-sheet-header";
import {
  buildSheetRows,
  groupLinesByStage,
  groupRowsByContract,
  invoicedPeriods,
  sheetPeriods,
  sheetTotals,
  type SheetGroupId,
  type StageCosts,
} from "./billing-sheet-model";
import { BillingSheetRow } from "./billing-sheet-row";
import { useRemoveBillingMonth } from "./use-remove-billing-month";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/lib/toast";
import { formatPeriodHeading } from "./billing-sheet-model";

/**
 * The billing sheet: phases down, billing months across, cumulative % complete
 * in each cell. Rows sit in two collapsible groups — the original contract and
 * the change orders — each with its own subtotal, then a grand total.
 */

interface BillingSheetProps {
  projectId: string;
  currency: Currency;
  canManage: boolean;
  canBill: boolean;
  /**
   * Committed / actual / variance are the contractor's own cost position, so
   * they need `finances:viewCosts`; without it the columns are not rendered and
   * the costs request is never fired.
   */
  showCosts: boolean;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
}

/** Columns before the month columns, plus To date and Actions. */
const FIXED_COLUMNS = 9;
/** Committed, actual and variance drop out when costs are not shared. */
const COST_COLUMNS = 3;

export function BillingSheet({
  projectId,
  currency,
  canManage,
  canBill,
  showCosts,
  onEditValue,
  onOpenSchedule,
}: BillingSheetProps) {
  const { data: stages = [], isPending } = useStages(projectId);
  const { data: lines } = useProjectScheduleOfValues(projectId);
  const { data: finances } = useProjectFinances(projectId);
  const { data: contracts = [] } = useContracts(projectId);
  // Committed / actual per stage arrive from the costs side; the columns show
  // "—" until they do.
  const costs = useStageCosts(showCosts ? projectId : undefined).data as StageCosts | undefined;

  const [search, setSearch] = useState("");
  const [addedPeriods, setAddedPeriods] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Set<SheetGroupId>>(() => new Set());
  const [removing, setRemoving] = useState<string | null>(null);
  const removeMonth = useRemoveBillingMonth(projectId);

  const periods = useMemo(() => sheetPeriods(lines, addedPeriods), [lines, addedPeriods]);
  const invoiced = useMemo(() => invoicedPeriods(lines), [lines]);
  const rows = useMemo(
    () => buildSheetRows(stages, groupLinesByStage(lines), finances?.milestones, costs),
    [stages, lines, finances?.milestones, costs],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => row.stage.name.toLowerCase().includes(query));
  }, [rows, search]);
  const changeOrderIds = useMemo(
    () => new Set(contracts.filter((c) => c.kind === "change_order").map((c) => c.id)),
    [contracts],
  );
  const groups = useMemo(
    () => groupRowsByContract(visible, periods, changeOrderIds),
    [visible, periods, changeOrderIds],
  );
  const totals = useMemo(() => sheetTotals(visible, periods), [visible, periods]);

  const handleSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    [],
  );
  const addPeriod = useCallback((period: string) => {
    setAddedPeriods((current) => (current.includes(period) ? current : [...current, period]));
  }, []);
  const confirmRemove = useCallback(() => {
    if (!removing) return;
    // A column only added on screen has nothing saved against it yet.
    if (!(lines ?? []).some((line) => line.period === removing)) {
      setAddedPeriods((current) => current.filter((period) => period !== removing));
      setRemoving(null);
      return;
    }
    removeMonth.mutate(
      { period: removing, lines: lines ?? [] },
      {
        onSuccess: () => {
          setAddedPeriods((current) => current.filter((period) => period !== removing));
          setRemoving(null);
        },
        onError: (error) => toast(getApiErrorMessage(error), "error"),
      },
    );
  }, [removing, lines, removeMonth]);

  const toggleGroup = useCallback((id: SheetGroupId) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const columnCount = FIXED_COLUMNS + periods.length - (showCosts ? 0 : COST_COLUMNS);
  // Fixed columns are 56 + 185 + 126 + 141 per money column + 141 (To date) + 44; each month adds 150.
  const tableWidth = 56 + 185 + 126 + 141 * (showCosts ? 4 : 1) + 141 + 44 + 150 * periods.length;

  // Dropping a phase on another moves it to that place in the build order. Only within a contract group, so a change order's phases stay together.
  const reorderStages = useReorderStages();
  const handleReorder = useCallback(
    (draggedId: string, targetId: string) => {
      const from = stages.findIndex((stage) => stage.id === draggedId);
      const to = stages.findIndex((stage) => stage.id === targetId);
      if (from < 0 || to < 0 || from === to) return;
      const ids = stages.map((stage) => stage.id).filter((id) => id !== draggedId);
      ids.splice(ids.indexOf(targetId) + (from < to ? 1 : 0), 0, draggedId);
      reorderStages.mutate({ projectId, stageIds: ids }, { onError: (error) => toast(getApiErrorMessage(error), "error") });
    },
    [stages, projectId, reorderStages],
  );

  return (
    <>
      <div className="mt-[40px] flex flex-wrap items-center justify-between gap-3">
        <div className="w-full border border-[#EEEEEE] bg-white sm:max-w-[396px]">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search Phases"
            aria-label="Search phases"
            className="h-[34px] rounded-none pl-[44px] text-caption-l placeholder:text-[#A3A3A3] lg:text-caption-l"
          />
        </div>
        {canBill ? <AddMonthButton periods={periods} onAdd={addPeriod} /> : null}
      </div>

      <div className="mt-[16px] overflow-x-auto border border-[#EEEEEE] bg-white">
        <Table className="table-fixed" style={{ minWidth: tableWidth }}>
          <colgroup>
            <col style={{ width: 56 }} />
            <col style={{ width: 185 }} />
            <col style={{ width: 126 }} />
            {Array.from({ length: showCosts ? 4 : 1 }, (_, index) => (
              <col key={`money-${index}`} style={{ width: 141 }} />
            ))}
            {periods.map((period) => (
              <col key={period} style={{ width: 150 }} />
            ))}
            <col style={{ width: 141 }} />
            <col style={{ width: 44 }} />
          </colgroup>
          <TableHead>
            <BillingSheetHeader
              projectId={projectId}
              periods={periods}
              invoiced={invoiced}
              canBill={canBill}
              showCosts={showCosts}
              onRemovePeriod={canBill ? setRemoving : undefined}
            />
          </TableHead>
          <TableBody>
            {isPending ? (
              <TableEmptyRow colSpan={columnCount} className="py-12">
                <div className="flex items-center justify-center">
                  <Spinner size="md" />
                </div>
              </TableEmptyRow>
            ) : visible.length === 0 ? (
              <TableEmptyRow colSpan={columnCount}>
                <EmptyState
                  variant="inline"
                  title={stages.length === 0 ? "No phases on this build yet" : "No phases match that search"}
                  description={
                    stages.length === 0
                      ? "Phases come from the build plan, and once they exist you can price them and record what each one billed month by month."
                      : "Try a different phase name."
                  }
                />
              </TableEmptyRow>
            ) : (
              <>
                {groups.map((group) => {
                  const open = !collapsed.has(group.id);
                  return (
                    <GroupRows
                      key={group.id}
                      open={open}
                      onToggle={() => toggleGroup(group.id)}
                      group={group}
                      periods={periods}
                      projectId={projectId}
                      currency={currency}
                      canManage={canManage}
                      canBill={canBill}
                      certified={invoiced}
                      showCosts={showCosts}
                      columnCount={columnCount}
                      onEditValue={onEditValue}
                      onOpenSchedule={onOpenSchedule}
                      onReorder={canManage ? handleReorder : undefined}
                    />
                  );
                })}
                <BillingSheetTotals totals={totals} periods={periods} currency={currency} hasCosts={costs !== undefined} showCosts={showCosts} />
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={removing ? `Remove ${formatPeriodHeading(removing)} from the sheet?` : "Remove month"}
        description="The month's column and everything recorded in it are dropped. A month already certified on an invoice cannot be removed — the figure lives on that certificate."
        confirmLabel="Remove month"
        variant="danger"
        loading={removeMonth.isPending}
        onConfirm={confirmRemove}
      />
    </>
  );
}

BillingSheet.displayName = "BillingSheet";

interface GroupRowsProps {
  group: ReturnType<typeof groupRowsByContract>[number];
  open: boolean;
  onToggle: () => void;
  periods: string[];
  projectId: string;
  currency: Currency;
  canManage: boolean;
  canBill: boolean;
  certified: Set<string>;
  showCosts: boolean;
  columnCount: number;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
  onReorder?: (draggedId: string, targetId: string) => void;
}

function GroupRows({
  group,
  open,
  onToggle,
  periods,
  projectId,
  currency,
  canManage,
  canBill,
  certified,
  showCosts,
  columnCount,
  onEditValue,
  onOpenSchedule,
  onReorder,
}: GroupRowsProps) {
  return (
    <>
      <BillingSheetGroupHeader
        label={group.label}
        open={open}
        onToggle={onToggle}
        trailingColumns={columnCount - 2}
      />
      {open && group.rows.length === 0 ? (
        <BillingSheetGroupEmpty colSpan={columnCount}>No phases priced under this group yet.</BillingSheetGroupEmpty>
      ) : null}
      {open
        ? group.rows.map((row) => (
            <BillingSheetRow
              key={row.stage.id}
              row={row}
              periods={periods}
              projectId={projectId}
              currency={currency}
              canManage={canManage}
              canBill={canBill}
              certified={certified}
              showCosts={showCosts}
              onEditValue={onEditValue}
              onOpenSchedule={onOpenSchedule}
              onReorder={onReorder}
            />
          ))
        : null}
    </>
  );
}

GroupRows.displayName = "BillingSheetGroupRows";
