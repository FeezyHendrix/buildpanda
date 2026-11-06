import { useEffect, useRef, useState } from "react";
import { ReactSVG } from "react-svg";
import { Button } from "@/components/atoms/button";
import { TextInput } from "@/components/atoms/text-input";
import { icons2 } from "@/assets/icons2/icon2";
import { cn } from "@/lib/utils";

/**
 * The "Date" button with its "Filter by Date" popover: a from/to pair applied
 * together, with a reset. Dates are `yyyy-mm-dd`, or "" for open-ended.
 */
export function DateFilterPopover({
  dateFrom,
  dateTo,
  onApply,
}: {
  dateFrom: string;
  dateTo: string;
  onApply: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);
  const ref = useRef<HTMLDivElement>(null);
  const hasFilter = Boolean(dateFrom || dateTo);

  useEffect(() => {
    if (open) {
      setDraftFrom(dateFrom);
      setDraftTo(dateTo);
    }
  }, [open, dateFrom, dateTo]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function apply(): void {
    if (!draftFrom || !draftTo) return;
    // The menu stays open so the applied range is visible; it closes on an
    // outside click, Escape, or the Date button.
    onApply(draftFrom, draftTo);
  }

  function reset(): void {
    setDraftFrom("");
    setDraftTo("");
    onApply("", "");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Filter by date"
        className={cn(
          "flex h-10 items-center gap-2 border bg-white px-3 text-sm font-medium outline-none transition-colors",
          hasFilter
            ? "border-[#004DE7] text-[#004DE7]"
            : "border-[#EBEBEB] text-[#111827] hover:border-[#6B7280]",
        )}
      >
        <ReactSVG src={icons2.calendar} className="shrink-0 [&_svg]:size-[16px]" />
        Date
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[280px] border border-border bg-white p-5 shadow-xl">
          <p className="text-[16px] font-bold text-[#111827]">Filter by Date</p>

          <div className="mt-4 flex flex-col gap-1.5">
            <label
              htmlFor="date-filter-from"
              className="text-[13px] font-medium text-[#1E1E1E]"
            >
              From
            </label>
            <div
              className="relative"
              onClick={(e) =>
                (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.showPicker?.()
              }
            >
              <TextInput
                id="date-filter-from"
                type="date"
                placeholder="DD/MM/YY"
                value={draftFrom}
                onChange={setDraftFrom}
                aria-label="From date"
                className="h-11 w-full cursor-pointer pr-9 [&::-webkit-calendar-picker-indicator]:hidden"
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
              <ReactSVG
                src={icons2.calendar}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1.5">
            <label
              htmlFor="date-filter-to"
              className="text-[13px] font-medium text-[#1E1E1E]"
            >
              To
            </label>
            <div
              className="relative"
              onClick={(e) =>
                (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.showPicker?.()
              }
            >
              <TextInput
                id="date-filter-to"
                type="date"
                placeholder="DD/MM/YY"
                value={draftTo}
                onChange={setDraftTo}
                aria-label="To date"
                className="h-11 w-full cursor-pointer pr-9 [&::-webkit-calendar-picker-indicator]:hidden"
                onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
              />
              <ReactSVG
                src={icons2.calendar}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={apply}
            disabled={!draftFrom || !draftTo}
            className="mt-4 w-full"
          >
            Apply Filter
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={reset} className="mt-1 w-full">
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}

DateFilterPopover.displayName = "DateFilterPopover";
