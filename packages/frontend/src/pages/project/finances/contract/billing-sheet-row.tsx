import { useCallback, useMemo, useState, type DragEvent } from "react";
import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { TableCell, TableRow } from "@/components/atoms/table";
import { RowActionIcon } from "@/components/molecules/row-action-icon";
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import { formatCurrency } from "@/lib/formatters";
import type { Currency, MilestoneClaimState, Stage, StageStatus } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import { BillingMonthCell } from "./billing-month-cell";
import { formatCumulative, isForecastPeriod, stageVariance, type SheetRow } from "./billing-sheet-model";

/** Pills for the Claim state column: a claim's position when it has one, else the phase's own status. */
const PILL_BASE = "inline-flex h-[24px] items-center whitespace-nowrap rounded-full border px-[8px] text-caption-m font-medium";
const PILL_NEUTRAL = "border-[#E0E0E0] bg-white text-[#1E1E1E]";
const PILL_BLUE = "border-[#C6D6FA] bg-[#E6EDFD] text-[#004DE7]";
const PILL_GREEN = "border-[#B9F8CF] bg-[#F0FDF4] text-[#00A63E]";

const STATUS_PILL: Record<StageStatus, { label: string; className: string }> = {
  Pending: { label: "Not started", className: PILL_NEUTRAL },
  InProgress: { label: "In progress", className: PILL_BLUE },
  Done: { label: "Completed", className: PILL_GREEN },
};

const CLAIM_PILL: Record<MilestoneClaimState, { label: string; className: string }> = {
  pending: { label: "Pending", className: PILL_NEUTRAL },
  claimable: { label: "Claimable", className: PILL_BLUE },
  claimed: { label: "Claimed", className: "border-[#FFD8A8] bg-[#FFF8EB] text-[#E58A00]" },
  certified: { label: "Certified", className: "border-[#C6CCFF] bg-white text-[#5D5FEF]" },
  paid: { label: "Paid", className: PILL_GREEN },
};

/** Sticky-column classes, shared with the header and totals so they line up. */
export const STICKY_INDEX = "sticky left-0 z-10 w-[56px]";
export const STICKY_STAGE = "sticky left-[56px] z-10 w-[185px]";
export const UNPRICED_REASON = "Price the stage first";

/** The body-cell look: 14px, flush left to its column, 50px tall. */
export const SHEET_CELL = "h-[50px] p-0 pr-[16px] text-caption-l text-[#1E1E1E]";

/** Why a month's cells are closed. The correction goes on the next certificate. */
export function certifiedReason(period: string): string {
  return `${period} is certified on an issued certificate — raise the correction on the next one`;
}

const DASH = <span className="text-[#737373]">—</span>;

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
  /** Months already certified on an invoice; their cells are closed. */
  certified: Set<string>;
  /** Contractor cost columns; hidden without `finances:viewCosts`. */
  showCosts: boolean;
  onEditValue: (stage: Stage) => void;
  onOpenSchedule: (stage: Stage) => void;
  /** Dropping the dragged phase on this one; omitted when the reader cannot reorder. */
  onReorder?: (draggedId: string, targetId: string) => void;
}

export function BillingSheetRow({
  row,
  periods,
  projectId,
  currency,
  canManage,
  canBill,
  certified,
  showCosts,
  onEditValue,
  onOpenSchedule,
  onReorder,
}: BillingSheetRowProps) {
  const { stage, cost } = row;
  const pill = row.claimState ? CLAIM_PILL[row.claimState] : STATUS_PILL[stage.status];
  const priced = stage.value > 0;
  const variance = stageVariance(stage, cost);
  const [dragOver, setDragOver] = useState(false);

  const handleEditValue = useCallback(() => onEditValue(stage), [onEditValue, stage]);
  const handleOpenSchedule = useCallback(() => onOpenSchedule(stage), [onOpenSchedule, stage]);
  const actions = useMemo<RowActionItem[]>(
    () => [
      ...(canManage ? [{ label: "Edit value", icon: <RowActionIcon name="edit" />, onSelect: handleEditValue }] : []),
      { label: canManage ? "Schedule" : "View schedule", icon: <RowActionIcon name="schedule" />, onSelect: handleOpenSchedule },
    ],
    [canManage, handleEditValue, handleOpenSchedule],
  );

  const canDrag = Boolean(onReorder);
  function handleDrop(event: DragEvent<HTMLTableRowElement>): void {
    event.preventDefault();
    setDragOver(false);
    const draggedId = event.dataTransfer.getData("text/plain");
    if (draggedId && draggedId !== stage.id) onReorder?.(draggedId, stage.id);
  }

  return (
    <TableRow
      className={cn("group h-[50px] border-[#EEEEEE] hover:bg-[#FAFAFA]", dragOver && "bg-[#EEF3FF]")}
      draggable={canDrag}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", stage.id)}
      onDragOver={(event) => {
        if (!canDrag) return;
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <TableCell className={cn(STICKY_INDEX, SHEET_CELL, "bg-white pl-[28px] group-hover:bg-[#FAFAFA]")}>
        <span
          title={canDrag ? "Drag to reorder" : undefined}
          className={cn("flex size-[12px] items-center justify-center text-[#1E1E1E]", canDrag ? "cursor-grab active:cursor-grabbing" : "opacity-40")}
        >
          <ReactSVG src={icons2.reorder} className="flex [&_svg]:size-[12px]" aria-hidden />
        </span>
      </TableCell>
      <TableCell className={cn(STICKY_STAGE, SHEET_CELL, "bg-white group-hover:bg-[#FAFAFA]")}>
        <p className="truncate">{stage.name}</p>
      </TableCell>
      <TableCell className={SHEET_CELL}>
        <span className={cn(PILL_BASE, pill.className)}>{pill.label}</span>
      </TableCell>
      <TableCell className={cn(SHEET_CELL, "whitespace-nowrap tabular-nums")}>
        {priced ? formatCurrency(stage.value, currency) : <span className="text-[#737373]">Not priced</span>}
      </TableCell>
      {showCosts ? (
        <>
          <TableCell className={cn(SHEET_CELL, "whitespace-nowrap tabular-nums")}>{money(cost?.committed, currency)}</TableCell>
          <TableCell className={cn(SHEET_CELL, "whitespace-nowrap tabular-nums")}>{money(cost?.actual, currency)}</TableCell>
          <TableCell className={cn(SHEET_CELL, "whitespace-nowrap tabular-nums", variance !== undefined && variance < 0 && "text-negative-600")}>
            {money(variance, currency)}
          </TableCell>
        </>
      ) : null}
      {periods.map((period) => (
        <TableCell key={period} align="right" className="px-3">
          <BillingMonthCell
            projectId={projectId}
            stageId={stage.id}
            period={period}
            line={row.cells.get(period)}
            currency={currency}
            editable={canBill}
            forecast={isForecastPeriod(period)}
            disabledReason={!priced ? UNPRICED_REASON : certified.has(period) ? certifiedReason(period) : undefined}
          />
        </TableCell>
      ))}
      <TableCell className={cn(SHEET_CELL, "whitespace-nowrap tabular-nums")}>
        {row.toDate.percent === null ? (
          formatCurrency(row.toDate.amount, currency)
        ) : (
          <>
            <p className="font-semibold">{formatCumulative(row.toDate.percent)}</p>
            <p className="text-caption-m text-[#737373]">{formatCurrency(row.toDate.amount, currency)}</p>
          </>
        )}
      </TableCell>
      <TableCell className="p-0 pr-[16px]" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-center">
          <RowActionsMenu ariaLabel={`Actions for ${stage.name}`} items={actions} appearance="house" />
        </div>
      </TableCell>
    </TableRow>
  );
}

BillingSheetRow.displayName = "BillingSheetRow";
