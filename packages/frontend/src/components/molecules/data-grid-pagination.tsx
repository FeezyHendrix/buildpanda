import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={direction === "left" ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6l-3.5 3.5"} />
    </svg>
  );
}

ChevronIcon.displayName = "ChevronIcon";

interface DataGridPaginationProps {
  /** 1-based current page (already clamped to `pageCount` by the grid). */
  page: number;
  pageCount: number;
  /** Total rows after search + filters, across every page. */
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const pageButtonClass = "h-8 gap-1.5 px-2.5 text-xs";

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
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        "border-t border-grey-50 px-6 py-3",
      )}
    >
      <p className="text-xs text-gray-500">
        Showing{" "}
        <span className="font-semibold text-gray-700">
          {first}–{last}
        </span>{" "}
        of <span className="font-semibold text-gray-700">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={pageButtonClass}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronIcon direction="left" />
          Prev
        </Button>

        <p aria-live="polite" className="px-1 text-xs font-medium text-gray-600">
          Page <span className="text-gray-900">{page}</span> of {pageCount}
        </p>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={pageButtonClass}
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronIcon direction="right" />
        </Button>
      </div>
    </nav>
  );
}

DataGridPagination.displayName = "DataGridPagination";

export { DataGridPagination, type DataGridPaginationProps };
