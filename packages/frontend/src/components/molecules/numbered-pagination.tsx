import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumberedPaginationProps {
  /** 1-based current page. */
  page: number;
  pageSize: number;
  total: number;
  /** Plural noun for the "Showing 1 to 10 of 20 …" line. */
  noun: string;
  onPageChange: (page: number) => void;
}

/** 1 2 3 4 … 10: the ends and the neighbours of the current page, with gaps marked. */
function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 6) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const wanted = new Set([1, 2, page - 1, page, page + 1, pageCount]);
  if (page <= 3) wanted.add(3).add(4);
  const pages = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  return pages.flatMap((n, i) => (i > 0 && n - pages[i - 1]! > 1 ? ["gap" as const, n] : [n]));
}

/** Footer for a list that pages on the client: a range summary and numbered page buttons. */
function NumberedPagination({ page, pageSize, total, noun, onPageChange }: NumberedPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-caption-s text-gray-500">
        Showing {first} to {last} of {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex size-6 items-center justify-center text-[#1E1E1E] disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        {pageItems(page, pageCount).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className="w-6 text-center text-xs text-[#1E1E1E]">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={`Page ${item}`}
              aria-current={item === page ? "page" : undefined}
              onClick={() => onPageChange(item)}
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                item === page ? "bg-[#1E1E1E] text-white" : "text-[#1E1E1E] hover:bg-[#F5F5F5]",
              )}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="flex size-6 items-center justify-center text-[#1E1E1E] disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}

NumberedPagination.displayName = "NumberedPagination";

export { NumberedPagination, type NumberedPaginationProps };
