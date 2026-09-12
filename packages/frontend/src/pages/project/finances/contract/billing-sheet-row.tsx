import { useCallback, useMemo } from "react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import { TableCell, TableRow } from "@/components/atoms/table";
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import { formatCurrency } from "@/lib/formatters";
import type { Currency, MilestoneClaimState, Stage, StageStatus } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { BillingMonthCell } from "./billing-month-cell";
import { formatCumulative, stageVariance, type SheetRow } from "./billing-sheet-model";

const STATUS_META: Record<StageStatus, { tone: BadgeTone; label: string }> = {
  Pending: { tone: "neutral", label: "Not started" },
  InProgress: { tone: "info", label: "In progress" },
  Done: { tone: "success", label: "Completed" },
};

const CLAIM_META: Record<MilestoneClaimState, { tone: BadgeTone; label: string }> = {
  pending: { tone: "neutral", label: "Pending" },
  claimable: { tone: "info", label: "Claimable" },
  claimed: { tone: "warning", label: "Claimed" },
  certified: { tone: "accent", label: "Certified" },
  paid: { tone: "success", label: "Paid" },
};

/** Sticky-column classes, shared with the header and totals so they line up. */
export const STICKY_INDEX = "sticky left-0 z-10 w-14";
export const STICKY_STAGE = "sticky left-14 z-10 min-w-[220px]";
export const UNPRICED_REASON = "Price the stage first";

const DASH = <span className="text-black-200">—</span>;

function money(value: number | undefined, currency: Currency) {
  return value === undefined ? DASH : formatCurrency(value, currency);
}

interface BillingSheetRowProps {
  row: SheetRow;
  periods: string[];
  projectId: string;
  currency: Currency;
  canManage: boolean;
  canBill: boolean;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
}

export function BillingSheetRow({
  row,
  periods,
  projectId,
  currency,
  canManage,
  canBill,
  onEditValue,
  onOpenSchedule,
}: BillingSheetRowProps) {
  const { stage, cost } = row;
  const status = STATUS_META[stage.status];
  const claim = row.claimState ? CLAIM_META[row.claimState] : null;
  const priced = stage.value > 0;
  const variance = stageVariance(stage, cost);

  const handleEditValue = useCallback(() => onEditValue(stage), [onEditValue, stage]);
  const handleOpenSchedule = useCallback(() => onOpenSchedule(stage), [onOpenSchedule, stage]);
  const actions = useMemo<RowActionItem[]>(
    () => [
      ...(canManage ? [{ label: "Edit value", onSelect: handleEditValue }] : []),
      { label: canManage ? "Schedule" : "View schedule", onSelect: handleOpenSchedule },
    ],
    [canManage, handleEditValue, handleOpenSchedule],
  );

  return (
    <TableRow className="group hover:bg-[#FAFAFA]">
      <TableCell className={cn(STICKY_INDEX, "bg-white group-hover:bg-[#FAFAFA]")}>
        <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-[#F6F6F6] text-[12px] font-medium text-black-500">
          {row.index + 1}
        </span>
      </TableCell>
      <TableCell className={cn(STICKY_STAGE, "bg-white group-hover:bg-[#FAFAFA]")}>
        <p className="font-medium text-black-500">{stage.name}</p>
        <div className="mt-1">
          <Badge tone={status.tone} size="sm">{status.label}</Badge>
        </div>
      </TableCell>
      <TableCell>{claim ? <Badge tone={claim.tone} size="sm">{claim.label}</Badge> : DASH}</TableCell>
      <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums text-black-500">
        {priced ? formatCurrency(stage.value, currency) : <span className="font-normal text-black-200">Not priced</span>}
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">{money(cost?.committed, currency)}</TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">{money(cost?.actual, currency)}</TableCell>
      <TableCell
        align="right"
        className={cn("whitespace-nowrap tabular-nums", variance !== undefined && variance < 0 && "text-error-600")}
      >
        {money(variance, currency)}
      </TableCell>
      {periods.map((period) => (
        <TableCell key={period} align="right" className="px-3">
          <BillingMonthCell
            projectId={projectId}
            stageId={stage.id}
            period={period}
            line={row.cells.get(period)}
            currency={currency}
            editable={canBill}
            disabledReason={priced ? undefined : UNPRICED_REASON}
          />
        </TableCell>
      ))}
      <TableCell align="right" className="whitespace-nowrap bg-primary-50/40 tabular-nums">
        <p className="text-[13px] font-semibold text-black-500">{formatCumulative(row.toDate.percent)}</p>
        <p className="text-[11px] text-black-300">
          {row.toDate.percent === null ? " " : formatCurrency(row.toDate.amount, currency)}
        </p>
      </TableCell>
      <TableCell align="right">
        <div className="flex justify-end">
          <RowActionsMenu ariaLabel={`Actions for ${stage.name}`} items={actions} />
        </div>
      </TableCell>
    </TableRow>
  );
}

BillingSheetRow.displayName = "BillingSheetRow";
