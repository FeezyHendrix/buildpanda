import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/button";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  /** ISO date (yyyy-mm-dd) or "" when unset. */
  from: string;
  to: string;
  /** Text on the trigger — use `formatDateRangeLabel` to derive it. */
  label: string;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
  className?: string;
}

function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * Trigger label for the filter: the applied range when one is set, otherwise
 * the span of the data's own dates, otherwise the fallback ("Date range").
 */
function formatDateRangeLabel(
  from: string,
  to: string,
  dataDates: readonly string[],
  fallback = "Date range",
): string {
  if (from || to) {
    return [from && formatMonthYear(from), to && formatMonthYear(to)].filter(Boolean).join(" – ");
  }
  if (dataDates.length === 0) return fallback;
  const sorted = [...dataDates].sort();
  const first = formatMonthYear(sorted[0]);
  const last = formatMonthYear(sorted[sorted.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

const DATE_INPUT_CLASS =
  "h-8 w-full rounded-lg border border-[#F0F0F0] px-2 text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30";

/** From/to date popover for a filter row. Applies on "Apply", never on keystroke. */
function DateRangeFilter({ from, to, label, onApply, onClear, className }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  const ref = useRef<HTMLDivElement>(null);
  const hasFilter = Boolean(from || to);

  useEffect(() => {
    setLocalFrom(from);
    setLocalTo(to);
  }, [from, to]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
          hasFilter ? "border-primary bg-primary/5 text-primary" : "border-[#F0F0F0] bg-white text-gray-700",
        )}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {label}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>

      {open ? (
        <div role="dialog" aria-label="Date range" className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl bg-white p-4 shadow-lg ring-1 ring-black/5">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-gray-400">Date range</p>
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] text-gray-500">From</span>
              <input type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} className={DATE_INPUT_CLASS} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-gray-500">To</span>
              <input type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} className={DATE_INPUT_CLASS} />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            {hasFilter ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              className="ml-auto"
              onClick={() => {
                onApply(localFrom, localTo);
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

DateRangeFilter.displayName = "DateRangeFilter";

export { DateRangeFilter, formatDateRangeLabel, type DateRangeFilterProps };
