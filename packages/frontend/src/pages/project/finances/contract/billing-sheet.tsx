import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { SearchInput } from "@/components/atoms/search-input";
import { Spinner } from "@/components/atoms/spinner";
import { Table, TableBody, TableEmptyRow, TableHead } from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { useProjectFinances, useStageCosts } from "@/hooks/use-finances";
import { useProjectScheduleOfValues, useStages } from "@/hooks/use-stages";
import type { Currency, Stage } from "@/lib/project-types";
import { AddMonthButton } from "./add-month-button";
import { BillingSheetHeader, BillingSheetTotals } from "./billing-sheet-header";
import {
  buildSheetRows,
  groupLinesByStage,
  invoicedPeriods,
  sheetPeriods,
  sheetTotals,
  type StageCosts,
} from "./billing-sheet-model";
import { BillingSheetRow } from "./billing-sheet-row";

/**
 * The billing sheet: stages down, billing months across, cumulative % complete
 * in each cell. It is the primary Stages & billing surface; the planned-share
 * drawer stays reachable from each row's actions.
 */

interface BillingSheetProps {
  projectId: string;
  currency: Currency;
  canManage: boolean;
  canBill: boolean;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
}

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
  // Committed / actual per stage arrive from the costs side; the columns show
  // "—" until they do.
  const costs = useStageCosts(projectId).data as StageCosts | undefined;

  const [search, setSearch] = useState("");
  const [addedPeriods, setAddedPeriods] = useState<string[]>([]);

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
  const totals = useMemo(() => sheetTotals(visible, periods), [visible, periods]);

  const handleSearch = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value),
    [],
  );
  const addPeriod = useCallback((period: string) => {
    setAddedPeriods((current) => (current.includes(period) ? current : [...current, period]));
  }, []);

  const columnCount = 9 + periods.length;

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="w-full rounded-lg bg-[#F6F6F6] lg:max-w-md">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search stages"
            aria-label="Search stages"
          />
        </div>
        {canBill ? <AddMonthButton periods={periods} onAdd={addPeriod} /> : null}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-grey-50 bg-white">
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
                  title={stages.length === 0 ? "No stages on this build yet" : "No stages match that search"}
                  description={
                    stages.length === 0
                      ? "Stages come from the build plan, and once they exist you can price them and record what each one billed month by month."
                      : "Try a different stage name."
                  }
                />
              </TableEmptyRow>
            ) : (
              <>
                {visible.map((row) => (
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
                ))}
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
