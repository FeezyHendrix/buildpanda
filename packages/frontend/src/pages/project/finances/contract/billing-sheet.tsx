import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { SearchInput } from "@/components/atoms/search-input";
import { Spinner } from "@/components/atoms/spinner";
import { Table, TableBody, TableEmptyRow, TableHead } from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { useContracts } from "@/hooks/use-contracts";
import { useProjectFinances, useStageCosts } from "@/hooks/use-finances";
import { useProjectScheduleOfValues, useStages } from "@/hooks/use-stages";
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
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
}

/** Columns before the month columns, plus To date and Actions. */
const FIXED_COLUMNS = 9;

export function BillingSheet({
  projectId,
  currency,
  canManage,
  canBill,
  onEditValue,
  onOpenSchedule,
}: BillingSheetProps) {
  const { data: stages = [], isPending } = useStages(projectId);
  const { data: lines } = useProjectScheduleOfValues(projectId);
  const { data: finances } = useProjectFinances(projectId);
  const { data: contracts = [] } = useContracts(projectId);
  // Committed / actual per stage arrive from the costs side; the columns show
  // "—" until they do.
  const costs = useStageCosts(projectId).data as StageCosts | undefined;

  const [search, setSearch] = useState("");
  const [addedPeriods, setAddedPeriods] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Set<SheetGroupId>>(() => new Set());

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
  const toggleGroup = useCallback((id: SheetGroupId) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const columnCount = FIXED_COLUMNS + periods.length;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="w-full rounded-lg bg-surface-alt lg:max-w-md">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search phases"
            aria-label="Search phases"
          />
        </div>
        {canBill ? <AddMonthButton periods={periods} onAdd={addPeriod} /> : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-grey-50 bg-white">
        <Table className="min-w-[1100px]">
          <TableHead>
            <BillingSheetHeader projectId={projectId} periods={periods} invoiced={invoiced} canBill={canBill} />
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
                      hasCosts={costs !== undefined}
                      columnCount={columnCount}
                      onEditValue={onEditValue}
                      onOpenSchedule={onOpenSchedule}
                    />
                  );
                })}
                <BillingSheetTotals totals={totals} periods={periods} currency={currency} hasCosts={costs !== undefined} />
              </>
            )}
          </TableBody>
        </Table>
      </div>
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
  hasCosts: boolean;
  columnCount: number;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
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
  hasCosts,
  columnCount,
  onEditValue,
  onOpenSchedule,
}: GroupRowsProps) {
  return (
    <>
      <BillingSheetGroupHeader
        label={group.label}
        count={group.rows.length}
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
              onEditValue={onEditValue}
              onOpenSchedule={onOpenSchedule}
            />
          ))
        : null}
      {open && group.rows.length > 0 ? (
        <BillingSheetTotals label="Subtotal" totals={group.totals} periods={periods} currency={currency} hasCosts={hasCosts} />
      ) : null}
    </>
  );
}

GroupRows.displayName = "BillingSheetGroupRows";
