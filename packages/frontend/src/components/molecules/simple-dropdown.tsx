import { useEffect, useRef, useState } from "react";
import { FilterTrigger } from "@/components/atoms/filter-trigger";
import { cn } from "@/lib/utils";

interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface SimpleDropdownProps<T extends string> {
  options: readonly DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * A compact single-select for a filter row (date view, sort order). Sits next
 * to `FilterTabs` and `DateRangeFilter` at the same 36px height.
 */
function SimpleDropdown<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SimpleDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0]!;

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
      <FilterTrigger
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {selected.label}
      </FilterTrigger>
      {open ? (
        <div role="listbox" className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-black/5">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-[13px] hover:bg-[#F6F6F6]",
                opt.value === value ? "font-semibold text-gray-900" : "text-gray-700",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

SimpleDropdown.displayName = "SimpleDropdown";

export { SimpleDropdown, type SimpleDropdownProps, type DropdownOption };
