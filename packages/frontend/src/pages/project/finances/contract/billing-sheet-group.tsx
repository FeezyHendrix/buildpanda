import { ChevronDown, ChevronUp } from "lucide-react";
import { TableCell, TableRow } from "@/components/atoms/table";
import { cn } from "@/lib/utils";
import { STICKY_INDEX, STICKY_STAGE } from "./billing-sheet-row";

/**
 * The collapsible header row of one contract group on the billing sheet —
 * "Original contract" / "Change orders". Click anywhere on it to fold the group.
 */

interface BillingSheetGroupHeaderProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  /** Number of columns after the two sticky ones. */
  trailingColumns: number;
}

export function BillingSheetGroupHeader({ label, open, onToggle, trailingColumns }: BillingSheetGroupHeaderProps) {
  return (
    <TableRow onClick={onToggle} className="h-[48px] border-[#EEEEEE] bg-white hover:bg-[#FAFAFA]" aria-expanded={open}>
      <TableCell className={cn(STICKY_INDEX, "bg-white p-0 pl-[16px]")}>
        {open ? <ChevronUp className="size-[16px] text-[#1E1E1E]" aria-hidden /> : <ChevronDown className="size-[16px] text-[#1E1E1E]" aria-hidden />}
      </TableCell>
      <TableCell className={cn(STICKY_STAGE, "bg-white p-0 text-caption-l font-semibold text-[#1E1E1E]")}>
        <span className="whitespace-nowrap">{label}</span>
      </TableCell>
      <TableCell colSpan={trailingColumns} className="p-0" />
    </TableRow>
  );
}

BillingSheetGroupHeader.displayName = "BillingSheetGroupHeader";

/** One muted line for a group with no phases in it yet. */
export function BillingSheetGroupEmpty({ colSpan, children }: { colSpan: number; children: string }) {
  return (
    <TableRow className="h-[48px] border-[#EEEEEE]">
      <TableCell colSpan={colSpan} className="py-0 pl-[56px] text-caption-l text-[#737373]">
        {children}
      </TableCell>
    </TableRow>
  );
}

BillingSheetGroupEmpty.displayName = "BillingSheetGroupEmpty";
