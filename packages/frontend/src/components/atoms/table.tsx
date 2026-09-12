import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * The one table, on Ernest's data-grid metrics: 44px uppercase header on the
 * off-white surface, 61px rows, hairline row rules, no zebra, the whole row
 * washes on hover, 24px padding on the outer cells so a full-bleed table lines
 * up with the page gutter. Pages only supply columns, rows and behaviour.
 */

type CellAlign = "left" | "right" | "center";

const ALIGN_CLASSES: Record<CellAlign, string | undefined> = {
  left: undefined,
  right: "text-right tabular-nums",
  center: "text-center",
};

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Classes for the scroll wrapper (e.g. `max-h-*` for a scrolling body). */
  wrapperClassName?: string;
  /** Pull the table out to the page edges (`-mx-6`) so its 24px cell padding becomes the gutter. */
  bleed?: boolean;
}

function Table({ className, wrapperClassName, bleed = false, children, ...props }: TableProps) {
  return (
    <div className={cn("overflow-x-auto border-t border-line-hair", bleed && "-mx-6", wrapperClassName)}>
      <table className={cn("w-full text-left text-sm text-ink", className)} {...props}>
        {children}
      </table>
    </div>
  );
}
Table.displayName = "Table";

function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-line-hair bg-surface-alt", className)}
      {...props}
    />
  );
}
TableHead.displayName = "TableHead";

interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: CellAlign;
}

function TableHeaderCell({ align = "left", className, ...props }: TableHeaderCellProps) {
  return (
    <th
      className={cn(
        "h-11 whitespace-nowrap px-3 text-xs font-medium uppercase text-ink-muted first:pl-6 last:pr-6",
        ALIGN_CLASSES[align],
        className,
      )}
      {...props}
    />
  );
}
TableHeaderCell.displayName = "TableHeaderCell";

function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}
TableBody.displayName = "TableBody";

type TableRowTone = "default" | "danger" | "muted" | "total";

const ROW_TONE_CLASSES: Record<TableRowTone, string | undefined> = {
  default: undefined,
  /** A missed / failed record — the row reads as a warning. */
  danger: "bg-negative-50 text-negative-600 hover:bg-negative-50 [&_td]:text-negative-600",
  /** A voided / superseded record — the row recedes. */
  muted: "text-ink-disabled [&_td]:text-ink-disabled",
  /** A totals row. */
  total: "bg-surface-alt font-semibold [&_td]:font-semibold",
};

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  tone?: TableRowTone;
}

/** `onClick` makes the row look clickable; `tone` marks missed/voided/total rows. */
function TableRow({ tone = "default", onClick, className, ...props }: TableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-line-hair bg-white transition-colors hover:bg-surface-alt",
        onClick ? "cursor-pointer" : undefined,
        ROW_TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
TableRow.displayName = "TableRow";

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: CellAlign;
}

function TableCell({ align = "left", className, ...props }: TableCellProps) {
  return (
    <td
      className={cn("px-3 py-[19px] align-middle text-sm text-ink first:pl-6 last:pr-6", ALIGN_CLASSES[align], className)}
      {...props}
    />
  );
}
TableCell.displayName = "TableCell";

/** An in-table section heading row (Ernest's "OTHER" divider). */
function TableSectionRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr className="border-b border-line-hair bg-surface-alt">
      <td colSpan={colSpan} className="h-11 px-3 text-xs font-medium uppercase text-ink-muted first:pl-6">
        {children}
      </td>
    </tr>
  );
}
TableSectionRow.displayName = "TableSectionRow";

interface TableEmptyRowProps {
  colSpan: number;
  /** Usually an `<EmptyState variant="inline" />`. */
  children: ReactNode;
  className?: string;
}

/** One full-width cell for an empty / loading state. */
function TableEmptyRow({ colSpan, children, className }: TableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={cn("px-6", className)}>
        {children}
      </td>
    </tr>
  );
}
TableEmptyRow.displayName = "TableEmptyRow";

export {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableSectionRow,
  TableEmptyRow,
};
export type {
  TableProps,
  TableHeaderCellProps,
  TableRowProps,
  TableRowTone,
  TableCellProps,
  TableEmptyRowProps,
  CellAlign,
};
