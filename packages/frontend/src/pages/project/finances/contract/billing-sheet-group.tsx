import { TableCell, TableRow } from "@/components/atoms/table";
import { cn } from "@/lib/utils";
import { STICKY_INDEX, STICKY_STAGE } from "./billing-sheet-row";

/**
 * The collapsible header row of one contract group on the billing sheet —
 * "Original contract (4)" / "Change orders (2)". Click anywhere on it to fold
 * the group; the count chip says how many phases sit inside.
 */

interface BillingSheetGroupHeaderProps {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** Number of columns after the two sticky ones. */
  trailingColumns: number;
}

export function BillingSheetGroupHeader({
  label,
  count,
  open,
  onToggle,
  trailingColumns,
}: BillingSheetGroupHeaderProps) {
  return (
    <TableRow onClick={onToggle} className="bg-surface-alt/70 hover:bg-surface-alt" aria-expanded={open}>
      <TableCell className={cn(STICKY_INDEX, "bg-surface-alt")}>
        <span
          aria-hidden="true"
          className={cn(
            "inline-block text-xs text-ink-muted transition-transform",
            open ? "rotate-90" : "rotate-0",
          )}
        >
          ▶
        </span>
      </TableCell>
      <TableCell className={cn(STICKY_STAGE, "bg-surface-alt")}>
        <span className="inline-flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{label}</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold tabular-nums text-ink-muted border border-line-hair">
            {count}
          </span>
        </span>
      </TableCell>
      <TableCell colSpan={trailingColumns} className="bg-surface-alt/70" />
    </TableRow>
  );
}

BillingSheetGroupHeader.displayName = "BillingSheetGroupHeader";

/** One muted line for a group with no phases in it yet. */
export function BillingSheetGroupEmpty({ colSpan, children }: { colSpan: number; children: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-xs text-ink-muted">
        {children}
      </TableCell>
    </TableRow>
  );
}

BillingSheetGroupEmpty.displayName = "BillingSheetGroupEmpty";
