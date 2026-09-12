import { Link } from "react-router-dom";
import { PlusIcon } from "@/components/atoms/project-nav-icons";
import { TableCell, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { formatCurrency } from "@/lib/formatters";
import type { Currency } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { formatPeriodHeading, type SheetTotals } from "./billing-sheet-model";
import { STICKY_INDEX, STICKY_STAGE } from "./billing-sheet-row";

/** Header and totals rows of the billing sheet; both track the month columns. */

interface BillingSheetHeaderProps {
  projectId: string;
  periods: string[];
  invoiced: Set<string>;
  canBill: boolean;
}

export function BillingSheetHeader({ projectId, periods, invoiced, canBill }: BillingSheetHeaderProps) {
  return (
    <tr>
      <TableHeaderCell scope="col" className={cn(STICKY_INDEX, "bg-[#F6F6F6]")} />
      <TableHeaderCell scope="col" className={cn(STICKY_STAGE, "bg-[#F6F6F6]")}>Stage</TableHeaderCell>
      <TableHeaderCell scope="col">Claim state</TableHeaderCell>
      <TableHeaderCell scope="col" align="right">Scheduled value</TableHeaderCell>
      <TableHeaderCell scope="col" align="right">Committed</TableHeaderCell>
      <TableHeaderCell scope="col" align="right">Actual</TableHeaderCell>
      <TableHeaderCell scope="col" align="right" title="Scheduled value less actual cost">Variance</TableHeaderCell>
      {periods.map((period) => (
        <TableHeaderCell key={period} scope="col" align="right" className="min-w-[140px] px-3">
          <div className="flex items-start justify-end gap-1.5">
            <div className="flex flex-col items-end">
              <span className="whitespace-nowrap">{formatPeriodHeading(period)}</span>
              <span className="whitespace-nowrap text-[10px] font-normal normal-case text-black-200">
                % complete · {invoiced.has(period) ? "billed" : "not billed"}
              </span>
            </div>
            {canBill && !invoiced.has(period) ? (
              <Link
                to={`/project/${projectId}/finances/billing?compose=1&period=${period}`}
                title={`Raise the ${formatPeriodHeading(period)} progress invoice`}
                aria-label={`Raise the ${formatPeriodHeading(period)} progress invoice`}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary-500 text-white hover:bg-primary-600"
              >
                <PlusIcon className="size-3.5" />
              </Link>
            ) : null}
          </div>
        </TableHeaderCell>
      ))}
      <TableHeaderCell scope="col" align="right" className="bg-primary-50 whitespace-nowrap">To date</TableHeaderCell>
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
}

const DASH = <span className="font-normal text-black-200">—</span>;

export function BillingSheetTotals({ totals, periods, currency, hasCosts }: BillingSheetTotalsProps) {
  return (
    <TableRow tone="total">
      <TableCell className={cn(STICKY_INDEX, "bg-[#FAFAFA]")} />
      <TableCell className={cn(STICKY_STAGE, "bg-[#FAFAFA]")}>Total</TableCell>
      <TableCell />
      <TableCell align="right" className="whitespace-nowrap tabular-nums">{formatCurrency(totals.scheduled, currency)}</TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">{hasCosts ? formatCurrency(totals.committed, currency) : DASH}</TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">{hasCosts ? formatCurrency(totals.actual, currency) : DASH}</TableCell>
      <TableCell align="right" className={cn("whitespace-nowrap tabular-nums", hasCosts && totals.variance < 0 && "text-error-600")}>
        {hasCosts ? formatCurrency(totals.variance, currency) : DASH}
      </TableCell>
      {periods.map((period) => (
        <TableCell key={period} align="right" className="whitespace-nowrap px-3 tabular-nums">
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
