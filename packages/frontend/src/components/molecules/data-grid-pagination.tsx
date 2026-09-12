import { Button } from "@/components/atoms/button";

interface DataGridPaginationProps {
  /** 1-based current page (already clamped to `pageCount` by the grid). */
  page: number;
  pageCount: number;
  /** Total rows after search + filters, across every page. */
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/** Ernest's grid footer: "1–25 of 138 items" on the left, Previous / Next on the right. */
function DataGridPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: DataGridPaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Table pagination"
      className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
    >
      <p className="text-sm font-medium text-ink tabular-nums" aria-live="polite">
        {first}–{last} of {total} items
      </p>

      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </nav>
  );
}

DataGridPagination.displayName = "DataGridPagination";

export { DataGridPagination, type DataGridPaginationProps };
