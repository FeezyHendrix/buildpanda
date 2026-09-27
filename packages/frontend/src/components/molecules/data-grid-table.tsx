import { type KeyboardEvent, type ReactNode } from "react";
import {
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { cn } from "@/lib/utils";
import {
  DataGridFilterPopover,
  type DataGridFilter,
  type DataGridFilterOption,
  type DataGridFilterValue,
  type DataGridValue,
} from "./data-grid-filter";

type DataGridAlign = "left" | "right" | "center";

type DataGridSortDirection = "asc" | "desc";

interface DataGridColumn<T> {
  /** Stable identity: React key, sort handle and filter handle. */
  id: string;
  /** Label shown in the header and used for the sort/filter accessible names. */
  header: string;
  /** Plain value used for search, sorting and filtering. */
  accessor: (row: T) => DataGridValue;
  /** Rich renderer for the body cell. Falls back to the accessor value. */
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  filter?: DataGridFilter;
  align?: DataGridAlign;
  /** CSS width for the column, e.g. `"12rem"` or `"15%"`. */
  width?: string;
  /** Merged onto both the header cell and every body cell of this column. */
  className?: string;
}

const HEADER_ALIGN_CLASS: Record<DataGridAlign, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const ARIA_SORT: Record<DataGridSortDirection, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
};

const SORT_HINT: Record<"none" | DataGridSortDirection, string> = {
  none: "not sorted, activate to sort ascending",
  asc: "sorted ascending, activate to sort descending",
  desc: "sorted descending, activate to clear sorting",
};

const NO_OPTIONS: readonly DataGridFilterOption[] = [];

/**
 * Direction is carried by the arrow shape, not by colour alone, so the sort
 * state stays legible without colour perception (WCAG 1.4.1).
 */
function SortGlyph({ direction }: { direction: DataGridSortDirection | null }) {
  return (
    <svg
      width="9"
      height="13"
      viewBox="0 0 9 13"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M4.5 1 7.6 4.6H1.4L4.5 1Z"
        className={direction === "asc" ? "fill-primary-500" : "fill-grey-100"}
      />
      <path
        d="M4.5 12 1.4 8.4h6.2L4.5 12Z"
        className={direction === "desc" ? "fill-primary-500" : "fill-grey-100"}
      />
    </svg>
  );
}

SortGlyph.displayName = "SortGlyph";

function DataGridHeaderCell<T>({
  column,
  direction,
  filterValue,
  filterOptions,
  onToggleSort,
  onFilterChange,
}: {
  column: DataGridColumn<T>;
  direction: DataGridSortDirection | null;
  filterValue: DataGridFilterValue | undefined;
  filterOptions: readonly DataGridFilterOption[];
  onToggleSort: (columnId: string) => void;
  onFilterChange: (columnId: string, next: DataGridFilterValue) => void;
}) {
  const align = column.align ?? "left";

  return (
    <TableHeaderCell
      scope="col"
      align={align}
      style={column.width ? { width: column.width } : undefined}
      aria-sort={
        column.sortable ? (direction ? ARIA_SORT[direction] : "none") : undefined
      }
      className={column.className}
    >
      <div className={cn("flex items-center gap-1.5", HEADER_ALIGN_CLASS[align])}>
        {column.sortable ? (
          <button
            type="button"
            onClick={() => onToggleSort(column.id)}
            aria-label={`${column.header}, ${SORT_HINT[direction ?? "none"]}`}
            className={cn(
              "-mx-1 inline-flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5",
              "outline-none transition-colors",
              "hover:bg-white focus-visible:shadow-focus",
              direction ? "text-primary-500" : "hover:text-ink",
            )}
          >
            <span className="truncate">{column.header}</span>
            <SortGlyph direction={direction} />
          </button>
        ) : (
          <span className="truncate">{column.header}</span>
        )}

        {column.filter ? (
          <DataGridFilterPopover
            label={column.header}
            filter={column.filter}
            options={filterOptions}
            value={filterValue}
            onChange={(next) => onFilterChange(column.id, next)}
          />
        ) : null}
      </div>
    </TableHeaderCell>
  );
}

DataGridHeaderCell.displayName = "DataGridHeaderCell";

function DataGridHeaderRow<T>({
  columns,
  sortColumnId,
  sortDirection,
  filters,
  filterOptions,
  onToggleSort,
  onFilterChange,
}: {
  columns: readonly DataGridColumn<T>[];
  sortColumnId: string | null;
  sortDirection: DataGridSortDirection | null;
  filters: ReadonlyMap<string, DataGridFilterValue>;
  filterOptions: ReadonlyMap<string, readonly DataGridFilterOption[]>;
  onToggleSort: (columnId: string) => void;
  onFilterChange: (columnId: string, next: DataGridFilterValue) => void;
}) {
  return (
    <TableHead>
      <tr>
        {columns.map((column) => (
          <DataGridHeaderCell
            key={column.id}
            column={column}
            direction={column.id === sortColumnId ? sortDirection : null}
            filterValue={filters.get(column.id)}
            filterOptions={filterOptions.get(column.id) ?? NO_OPTIONS}
            onToggleSort={onToggleSort}
            onFilterChange={onFilterChange}
          />
        ))}
      </tr>
    </TableHead>
  );
}

DataGridHeaderRow.displayName = "DataGridHeaderRow";

function renderValue(value: DataGridValue): ReactNode {
  if (value === null || value === "") {
    return <span className="text-ink-disabled">—</span>;
  }
  return String(value);
}

function DataGridRow<T>({
  row,
  columns,
  onRowClick,
}: {
  row: T;
  columns: readonly DataGridColumn<T>[];
  onRowClick: ((row: T) => void) | undefined;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>): void {
    if (!onRowClick) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onRowClick(row);
  }

  return (
    <TableRow
      tabIndex={onRowClick ? 0 : undefined}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      onKeyDown={onRowClick ? handleKeyDown : undefined}
      className={cn(
        "outline-none",
        onRowClick && "transition-colors focus-visible:bg-gray-50",
      )}
    >
      {columns.map((column) => (
        <TableCell
          key={column.id}
          align={column.align ?? "left"}
          className={column.className}
        >
          {column.cell ? column.cell(row) : renderValue(column.accessor(row))}
        </TableCell>
      ))}
    </TableRow>
  );
}

DataGridRow.displayName = "DataGridRow";

function DataGridStateRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <TableEmptyRow colSpan={colSpan} className="py-10">
      <div className="flex items-center justify-center">{children}</div>
    </TableEmptyRow>
  );
}

DataGridStateRow.displayName = "DataGridStateRow";

export {
  DataGridHeaderCell,
  DataGridHeaderRow,
  DataGridRow,
  DataGridStateRow,
  renderValue,
  type DataGridAlign,
  type DataGridColumn,
  type DataGridSortDirection,
};
