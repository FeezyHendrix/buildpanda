import { type KeyboardEvent, type ReactNode } from "react";
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

const CELL_ALIGN_CLASS: Record<DataGridAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
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
    <th
      scope="col"
      style={column.width ? { width: column.width } : undefined}
      aria-sort={
        column.sortable ? (direction ? ARIA_SORT[direction] : "none") : undefined
      }
      className={cn(
        "px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500",
        CELL_ALIGN_CLASS[align],
        column.className,
      )}
    >
      <div className={cn("flex items-center gap-1.5", HEADER_ALIGN_CLASS[align])}>
        {column.sortable ? (
          <button
            type="button"
            onClick={() => onToggleSort(column.id)}
            aria-label={`${column.header}, ${SORT_HINT[direction ?? "none"]}`}
            className={cn(
              "-mx-1 inline-flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5",
              "tracking-wider outline-none transition-colors",
              "hover:bg-white focus-visible:ring-2 focus-visible:ring-gray-900/10",
              direction
                ? "text-primary-500"
                : "text-gray-500 hover:text-gray-700",
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
    </th>
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
    <thead className="border-b border-grey-50 bg-[#FAFAFA]">
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
    </thead>
  );
}

DataGridHeaderRow.displayName = "DataGridHeaderRow";

function renderValue(value: DataGridValue): ReactNode {
  if (value === null || value === "") {
    return <span className="text-gray-300">—</span>;
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
    <tr
      tabIndex={onRowClick ? 0 : undefined}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      onKeyDown={onRowClick ? handleKeyDown : undefined}
      className={cn(
        "border-b border-grey-50/70 outline-none last:border-b-0",
        onRowClick &&
          "cursor-pointer transition-colors hover:bg-[#FAFAFA] focus-visible:bg-[#FAFAFA]",
      )}
    >
      {columns.map((column) => (
        <td
          key={column.id}
          className={cn(
            "px-6 py-4 text-sm text-black-400",
            CELL_ALIGN_CLASS[column.align ?? "left"],
            column.className,
          )}
        >
          {column.cell ? column.cell(row) : renderValue(column.accessor(row))}
        </td>
      ))}
    </tr>
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
    <tr>
      <td colSpan={colSpan} className="px-6 py-10">
        <div className="flex items-center justify-center">{children}</div>
      </td>
    </tr>
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
