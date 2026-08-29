import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/atoms/button";
import { SearchInput } from "@/components/atoms/search-input";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import {
  isFilterValueActive,
  matchesFilterValue,
  type DataGridFilterOption,
  type DataGridFilterValue,
  type DataGridValue,
} from "./data-grid-filter";
import {
  DataGridHeaderRow,
  DataGridRow,
  DataGridStateRow,
  type DataGridColumn,
  type DataGridSortDirection,
} from "./data-grid-table";
import { DataGridPagination } from "./data-grid-pagination";

interface DataGridSort {
  columnId: string;
  direction: DataGridSortDirection;
}

interface DataGridProps<T> {
  data: T[];
  columns: DataGridColumn<T>[];
  getRowId: (row: T) => string;
  /** Fields the search box scans. Defaults to every column accessor. */
  searchKeys?: ((row: T) => DataGridValue)[];
  initialSort?: DataGridSort;
  pageSize?: number;
  isLoading?: boolean;
  /** Rendered when there is no data at all; filtered-empty has its own state. */
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  className?: string;
}

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 200;
const NO_FILTERS: ReadonlyMap<string, DataGridFilterValue> = new Map();

const DEFAULT_EMPTY_STATE = (
  <EmptyState
    title="Nothing to show yet"
    description="Records will appear here once they have been added."
    className="py-2"
  />
);

function toSearchText(value: DataGridValue): string {
  return value === null ? "" : String(value).toLowerCase();
}

/** Nulls last, numbers numerically, strings naturally so `Item 2` precedes `Item 10`. */
function compareValues(a: DataGridValue, b: DataGridValue): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function DataGrid<T>({
  data,
  columns,
  getRowId,
  searchKeys,
  initialSort,
  pageSize = DEFAULT_PAGE_SIZE,
  isLoading = false,
  emptyState,
  onRowClick,
  searchPlaceholder = "Search records",
  className,
}: DataGridProps<T>) {
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DataGridSort | null>(initialSort ?? null);
  const [filters, setFilters] =
    useState<ReadonlyMap<string, DataGridFilterValue>>(NO_FILTERS);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSearch(searchDraft.trim().toLowerCase()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const columnById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  );

  const searchAccessors = useMemo(
    () => searchKeys ?? columns.map((column) => column.accessor),
    [searchKeys, columns],
  );

  const filterOptions = useMemo(() => {
    const options = new Map<string, readonly DataGridFilterOption[]>();
    for (const column of columns) {
      if (column.filter?.kind !== "select") continue;
      if (column.filter.options) {
        options.set(column.id, column.filter.options);
        continue;
      }
      const seen = new Set<string>();
      const derived: DataGridFilterOption[] = [];
      for (const row of data) {
        const raw = column.accessor(row);
        if (raw === null || raw === "") continue;
        const value = String(raw);
        if (seen.has(value)) continue;
        seen.add(value);
        derived.push({ value, label: value });
      }
      derived.sort((a, b) => a.label.localeCompare(b.label));
      options.set(column.id, derived);
    }
    return options;
  }, [columns, data]);

  const activeFilters = useMemo(() => {
    const pairs: { column: DataGridColumn<T>; filter: DataGridFilterValue }[] =
      [];
    for (const [columnId, filter] of filters) {
      const column = columnById.get(columnId);
      if (column && isFilterValueActive(filter)) pairs.push({ column, filter });
    }
    return pairs;
  }, [filters, columnById]);

  const filteredRows = useMemo(() => {
    if (!search && activeFilters.length === 0) return data;
    return data.filter((row) => {
      for (const { column, filter } of activeFilters) {
        if (!matchesFilterValue(column.accessor(row), filter)) return false;
      }
      if (!search) return true;
      for (const accessor of searchAccessors) {
        if (toSearchText(accessor(row)).includes(search)) return true;
      }
      return false;
    });
  }, [data, search, activeFilters, searchAccessors]);

  const sortedRows = useMemo(() => {
    const column = sort ? columnById.get(sort.columnId) : undefined;
    if (!sort || !column) return filteredRows;
    const factor = sort.direction === "asc" ? 1 : -1;
    const { accessor } = column;
    return [...filteredRows].sort(
      (a, b) => factor * compareValues(accessor(a), accessor(b)),
    );
  }, [filteredRows, sort, columnById]);

  const total = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchDraft(event.target.value);
      setPage(1);
    },
    [],
  );

  const handleToggleSort = useCallback((columnId: string) => {
    setSort((current) => {
      if (current?.columnId !== columnId) return { columnId, direction: "asc" };
      return current.direction === "asc"
        ? { columnId, direction: "desc" }
        : null;
    });
    setPage(1);
  }, []);

  const handleFilterChange = useCallback(
    (columnId: string, next: DataGridFilterValue) => {
      setFilters((current) => {
        const updated = new Map(current);
        if (isFilterValueActive(next)) updated.set(columnId, next);
        else updated.delete(columnId);
        return updated;
      });
      setPage(1);
    },
    [],
  );

  const handleReset = useCallback(() => {
    setFilters(NO_FILTERS);
    setSearchDraft("");
    setSearch("");
    setPage(1);
  }, []);

  const isNarrowed = search.length > 0 || activeFilters.length > 0;
  const state = isLoading ? "loading" : total === 0 ? "empty" : "rows";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-xs rounded-lg bg-[#F6F6F6]">
          <SearchInput
            value={searchDraft}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>

        {isNarrowed ? (
          <div className="flex items-center gap-2">
            <p aria-live="polite" className="text-xs text-gray-500">
              {total} {total === 1 ? "match" : "matches"}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={handleReset}
            >
              Reset
            </Button>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-grey-50 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <DataGridHeaderRow
              columns={columns}
              sortColumnId={sort?.columnId ?? null}
              sortDirection={sort?.direction ?? null}
              filters={filters}
              filterOptions={filterOptions}
              onToggleSort={handleToggleSort}
              onFilterChange={handleFilterChange}
            />
            <tbody>
              {state === "loading" ? (
                <DataGridStateRow colSpan={columns.length}>
                  <Spinner size="md" />
                </DataGridStateRow>
              ) : null}

              {state === "empty" ? (
                <DataGridStateRow colSpan={columns.length}>
                  {isNarrowed ? (
                    <EmptyState
                      title="No matching records"
                      description="Adjust your search or clear the column filters to see everything."
                      className="py-2"
                      action={
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleReset}
                        >
                          Reset filters
                        </Button>
                      }
                    />
                  ) : (
                    (emptyState ?? DEFAULT_EMPTY_STATE)
                  )}
                </DataGridStateRow>
              ) : null}

              {state === "rows"
                ? pageRows.map((row) => (
                    <DataGridRow
                      key={getRowId(row)}
                      row={row}
                      columns={columns}
                      onRowClick={onRowClick}
                    />
                  ))
                : null}
            </tbody>
          </table>
        </div>

        {state === "rows" ? (
          <DataGridPagination
            page={currentPage}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </div>
  );
}

DataGrid.displayName = "DataGrid";

export { DataGrid, type DataGridProps, type DataGridSort };
export type {
  DataGridAlign,
  DataGridColumn,
  DataGridSortDirection,
} from "./data-grid-table";
export type {
  DataGridFilter,
  DataGridFilterOption,
  DataGridFilterValue,
  DataGridValue,
} from "./data-grid-filter";
