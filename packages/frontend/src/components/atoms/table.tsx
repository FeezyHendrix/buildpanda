import type {
  HTMLAttributes,
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * The one table. Pages used to hand-roll `<table>` markup with two competing
 * header styles; the look lives here now and pages only supply columns, rows
 * and behaviour (sorting, row click, sticky columns).
 */

type CellAlign = "left" | "right" | "center";

const ALIGN_CLASSES: Record<CellAlign, string | undefined> = {
  left: undefined,
  right: "text-right",
  center: "text-center",
};

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Classes for the scroll wrapper (e.g. `max-h-*` for a scrolling body). */
  wrapperClassName?: string;
}

/** `<div class="overflow-x-auto">` around a full-width, left-aligned table. */
function Table({ className, wrapperClassName, children, ...props }: TableProps) {
  return (
    <div className={cn("overflow-x-auto", wrapperClassName)}>
      <table className={cn("w-full text-left text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}
Table.displayName = "Table";

function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-[#EDEDED] bg-[#F6F6F6]", className)}
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
        "px-6 py-3 text-[11px] font-semibold capitalize text-black-300",
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
  danger: "bg-error-50 text-error-700 [&_td]:text-error-700",
  /** A voided / superseded record — the row recedes. */
  muted: "text-black-200 [&_td]:text-black-200",
  /** A totals row. */
  total: "bg-[#FAFAFA] font-semibold [&_td]:font-semibold",
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
        "border-b border-[#F0F0F0] last:border-b-0",
        onClick ? "cursor-pointer hover:bg-gray-50" : undefined,
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
      className={cn("px-6 py-3 text-[13px] text-[#131B2E]", ALIGN_CLASSES[align], className)}
      {...props}
    />
  );
}
TableCell.displayName = "TableCell";

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
