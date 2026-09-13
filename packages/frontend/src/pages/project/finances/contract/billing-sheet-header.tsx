import { Link } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { TableCell, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { BUDGET_INVOICES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCurrency } from "@/lib/formatters";
import type { Currency } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { formatPeriodHeading, isForecastPeriod, type SheetTotals } from "./billing-sheet-model";
import { STICKY_INDEX, STICKY_STAGE } from "./billing-sheet-row";

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
    <TableHeaderCell scope="col" align="right" className="min-w-[150px] px-3">
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
      <TableHeaderCell scope="col" className={cn(STICKY_INDEX, "bg-surface-alt")} />
      <TableHeaderCell scope="col" className={cn(STICKY_STAGE, "bg-surface-alt")}>Stage</TableHeaderCell>
      <TableHeaderCell scope="col">Claim state</TableHeaderCell>
      <TableHeaderCell scope="col" align="right">Scheduled value</TableHeaderCell>
      {showCosts ? (
        <>
          <TableHeaderCell scope="col" align="right">Committed</TableHeaderCell>
          <TableHeaderCell scope="col" align="right">Actual</TableHeaderCell>
          <TableHeaderCell scope="col" align="right" title="Scheduled value less actual cost">Variance</TableHeaderCell>
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
      <TableHeaderCell scope="col" align="right" className="whitespace-nowrap bg-primary-50">To date</TableHeaderCell>
      <TableHeaderCell scope="col" align="right">Actions</TableHeaderCell>
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

const DASH = <span className="font-normal text-ink-muted">—</span>;

export function BillingSheetTotals({ totals, periods, currency, hasCosts, showCosts, label = "Total" }: BillingSheetTotalsProps) {
  return (
    <TableRow tone="total">
      <TableCell className={cn(STICKY_INDEX, "bg-surface-alt")} />
      <TableCell className={cn(STICKY_STAGE, "bg-surface-alt")}>{label}</TableCell>
      <TableCell />
      <TableCell align="right" className="whitespace-nowrap tabular-nums">{formatCurrency(totals.scheduled, currency)}</TableCell>
      {showCosts ? (
        <>
          <TableCell align="right" className="whitespace-nowrap tabular-nums">{hasCosts ? formatCurrency(totals.committed, currency) : DASH}</TableCell>
          <TableCell align="right" className="whitespace-nowrap tabular-nums">{hasCosts ? formatCurrency(totals.actual, currency) : DASH}</TableCell>
          <TableCell align="right" className={cn("whitespace-nowrap tabular-nums", hasCosts && totals.variance < 0 && "text-negative-600")}>
            {hasCosts ? formatCurrency(totals.variance, currency) : DASH}
          </TableCell>
        </>
      ) : null}
      {periods.map((period) => (
        <TableCell
          key={period}
          align="right"
          className={cn(
            "whitespace-nowrap px-3 tabular-nums",
            isForecastPeriod(period) && "font-normal italic text-ink-muted",
          )}
        >
          {formatCurrency(totals.byPeriod.get(period) ?? 0, currency)}
        </TableCell>
      ))}
      <TableCell align="right" className="whitespace-nowrap bg-primary-50/60 tabular-nums">
        {formatCurrency(totals.toDate, currency)}
      </TableCell>
      <TableCell />
    </TableRow>
  );
}

BillingSheetTotals.displayName = "BillingSheetTotals";
