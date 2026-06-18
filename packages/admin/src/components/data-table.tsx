import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Input, Button } from "@/components/ui";
import { SearchIcon } from "@/components/icons";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  rowHref,
  onRowClick,
  emptyLabel = "No records found.",
}: {
  columns: Column<T>[];
  rows: T[];
  rowHref?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  emptyLabel?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-faint text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted", col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-muted">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const href = rowHref?.(row);
                const clickable = href !== undefined || onRowClick !== undefined;
                return (
                  <tr
                    key={row.id ?? i}
                    onClick={
                      href ? () => navigate(href) : onRowClick ? () => onRowClick(row) : undefined
                    }
                    className={cn(
                      "border-b border-line last:border-0",
                      clickable && "cursor-pointer hover:bg-surface-faint",
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3 align-middle text-ink", col.className)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

export function Pagination({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {from}–{to} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canPrev}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canNext}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
