import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { TableCell, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { BUDGET_INVOICES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCurrency } from "@/lib/formatters";
import type { Currency } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { formatPeriodHeading, isForecastPeriod, type SheetTotals } from "./billing-sheet-model";
import { SHEET_CELL, STICKY_INDEX, STICKY_STAGE } from "./billing-sheet-row";

/** The compact header: 12px, flush left to its column, 45px tall, as designed. */
const HEAD = "h-[45px] p-0 pr-[16px] text-caption-m font-medium normal-case text-[#525252]";

/**
 * Header and totals rows of the billing sheet; both track the month columns.
 *
 * A month reads as one of three things, and the column says which: CERTIFIED
 * (closed — the figure lives on an issued certificate), FORECAST (a projection
 * of a month that has not happened, never claimable) or claimable, in which
 * case it offers to raise the progress invoice. An uncertified month can also
 * be dropped from the sheet.
 */

interface BillingSheetHeaderProps {
  projectId: string;
  periods: string[];
  invoiced: Set<string>;
  canBill: boolean;
  /** Contractor cost columns; hidden without `finances:viewCosts`. */
  showCosts: boolean;
  onRemovePeriod?: (period: string) => void;
}

function PeriodHeading({
  projectId,
  period,
  certified,
  canBill,
  onRemovePeriod,
}: {
  projectId: string;
  period: string;
  certified: boolean;
  canBill: boolean;
  onRemovePeriod?: (period: string) => void;
}) {
  const forecast = isForecastPeriod(period);
  const label = formatPeriodHeading(period);

  return (
    <TableHeaderCell scope="col" align="right" className="min-w-[150px] px-3 py-1 text-caption-m font-medium normal-case text-[#525252]">
      <div className="flex items-start justify-end gap-1.5">
        <div className="flex flex-col items-end gap-1">
          <span className="whitespace-nowrap">{label}</span>
          {certified ? (
            <Badge tone="accent" size="sm" dot>
              Certified
            </Badge>
          ) : forecast ? (
            <Badge tone="neutral" size="sm" dot>
              Forecast
            </Badge>
          ) : (
            <span className="whitespace-nowrap text-xs font-normal normal-case text-ink-muted">
              % complete · not billed
            </span>
          )}
        </div>
        {canBill && !certified && !forecast ? (
          <Link
            to={`/project/${projectId}/${financeTabPath(BUDGET_INVOICES_PATH, "invoices")}&compose=1&period=${period}`}
            title={`Raise the ${label} progress invoice`}
            aria-label={`Raise the ${label} progress invoice`}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-500 text-white hover:bg-primary-600"
          >
            <PlusIcon className="size-3.5" />
          </Link>
        ) : null}
        {canBill && !certified && onRemovePeriod ? (
          <button
            type="button"
            onClick={() => onRemovePeriod(period)}
            title={`Remove ${label} from the sheet`}
            aria-label={`Remove ${label} from the sheet`}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-negative-50 hover:text-negative-600"
          >
            ×
          </button>
        ) : null}
      </div>
    </TableHeaderCell>
  );
}

PeriodHeading.displayName = "PeriodHeading";

export function BillingSheetHeader({
  projectId,
  periods,
  invoiced,
  canBill,
  showCosts,
  onRemovePeriod,
}: BillingSheetHeaderProps) {
  return (
    <tr>
      <TableHeaderCell scope="col" className={cn(STICKY_INDEX, HEAD, "bg-[#F6F6F6]")}>
        <span className="sr-only">Reorder</span>
      </TableHeaderCell>
      <TableHeaderCell scope="col" className={cn(STICKY_STAGE, HEAD, "bg-[#F6F6F6]")}>Build Stages</TableHeaderCell>
      <TableHeaderCell scope="col" className={HEAD}>Claim state</TableHeaderCell>
      <TableHeaderCell scope="col" className={HEAD}>Scheduled value</TableHeaderCell>
      {showCosts ? (
        <>
          <TableHeaderCell scope="col" className={HEAD}>Committed</TableHeaderCell>
          <TableHeaderCell scope="col" className={HEAD}>Actual</TableHeaderCell>
          <TableHeaderCell scope="col" className={HEAD} title="Scheduled value less actual cost">Variance</TableHeaderCell>
        </>
      ) : null}
      {periods.map((period) => (
        <PeriodHeading
          key={period}
          projectId={projectId}
          period={period}
          certified={invoiced.has(period)}
          canBill={canBill}
          onRemovePeriod={onRemovePeriod}
        />
      ))}
      <TableHeaderCell scope="col" className={cn(HEAD, "whitespace-nowrap")}>To date</TableHeaderCell>
      <TableHeaderCell scope="col" className={HEAD}>
        <span className="sr-only">Actions</span>
      </TableHeaderCell>
    </tr>
  );
}

BillingSheetHeader.displayName = "BillingSheetHeader";

interface BillingSheetTotalsProps {
  totals: SheetTotals;
  periods: string[];
  currency: Currency;
  hasCosts: boolean;
  showCosts: boolean;
  /** "Total" for the sheet, "Subtotal" for a contract group. */
  label?: string;
}

const DASH = <span className="text-[#737373]">—</span>;

export function BillingSheetTotals({ totals, periods, currency, hasCosts, showCosts, label = "Total" }: BillingSheetTotalsProps) {
  const cell = cn(SHEET_CELL, "whitespace-nowrap tabular-nums");
  return (
    <TableRow className="h-[50px] border-[#EEEEEE] bg-[#F6F6F6]">
      <TableCell className={cn(STICKY_INDEX, SHEET_CELL, "bg-[#F6F6F6]")} />
      <TableCell className={cn(STICKY_STAGE, SHEET_CELL, "bg-[#F6F6F6] font-semibold")}>{label}</TableCell>
      <TableCell className={SHEET_CELL} />
      <TableCell className={cell}>{formatCurrency(totals.scheduled, currency)}</TableCell>
      {showCosts ? (
        <>
          <TableCell className={cell}>{hasCosts ? formatCurrency(totals.committed, currency) : DASH}</TableCell>
          <TableCell className={cell}>{hasCosts ? formatCurrency(totals.actual, currency) : DASH}</TableCell>
          <TableCell className={cn(cell, hasCosts && totals.variance < 0 && "text-negative-600")}>
            {hasCosts ? formatCurrency(totals.variance, currency) : DASH}
          </TableCell>
        </>
      ) : null}
      {periods.map((period) => (
        <TableCell key={period} align="right" className={cn("h-[50px] whitespace-nowrap px-3 py-0 text-caption-l tabular-nums", isForecastPeriod(period) && "italic text-[#737373]")}>
          {formatCurrency(totals.byPeriod.get(period) ?? 0, currency)}
        </TableCell>
      ))}
      <TableCell className={cell}>{formatCurrency(totals.toDate, currency)}</TableCell>
      <TableCell className="p-0" />
    </TableRow>
  );
}

BillingSheetTotals.displayName = "BillingSheetTotals";
