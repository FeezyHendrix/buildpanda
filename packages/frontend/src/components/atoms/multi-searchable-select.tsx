import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface MultiSelectItem {
  value: string;
  label: string;
  meta?: string;
}

interface MultiSearchableSelectProps {
  items: MultiSelectItem[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

function ChevronIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M1 1l4 4 4-4" />
    </svg>
  );
}

function SearchIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function MultiSearchableSelect({
  items,
  values,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search",
  emptyText = "No results found.",
  disabled,
}: MultiSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const selectedSet = useMemo(() => new Set(values), [values]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => i.label.toLowerCase().includes(term) || i.value.toLowerCase().includes(term));
  }, [items, query]);

  const labelOf = useMemo(() => {
    const map = new Map(items.map((i) => [i.value, i.label]));
    return (v: string) => map.get(v) ?? v;
  }, [items]);

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  }

  // position popup below trigger (fixed, via portal)
  function updatePosition() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPopupStyle({
      position: "fixed",
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
      zIndex: 60,
    });
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onResize = () => updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popupRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const triggerLabel =
    values.length === 0 ? null : values.length === 1 ? labelOf(values[0]!) : `${values.length} selected`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 bg-white px-3.5 text-[14px] text-[#1E1E1E]",
          "border border-[#EBEBEB] outline-none",
          "focus-visible:border-[#004DE7] focus-visible:ring-1 focus-visible:ring-[#004DE7]/10",
          "cursor-default select-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {triggerLabel ? (
          <span className="truncate text-left">{triggerLabel}</span>
        ) : (
          <span className="truncate text-left text-[#B0B0B0]">{placeholder}</span>
        )}
        <span className="flex shrink-0 text-[#767676]">
          <ChevronIcon />
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popupRef}
            style={popupStyle}
            className={cn(
              "origin-top flex min-h-[120px] flex-col border border-[#EBEBEB] bg-grey-50 p-1 shadow-lg",
              "max-h-[min(20rem,calc(100vh-8rem))]",
            )}
          >
            {/* Search row */}
            <div className="flex items-center gap-2.5 border-b border-[#EBEBEB] bg-white px-3.5">
              <SearchIcon className="size-[18px] shrink-0 text-[#1E1E1E]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-11 flex-1 bg-transparent text-[14px] text-[#1E1E1E] border-0 outline-none ring-0 placeholder:text-[#B0B0B0]"
              />
            </div>

            <div className="flex flex-1 flex-col bg-grey-50 pt-1 min-h-0">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-black-500">{emptyText}</div>
              ) : (
                <div className="max-h-[160px] flex-1 overflow-y-auto overscroll-contain space-y-1 no-scrollbar">
                  {filtered.map((item) => {
                    const selected = selectedSet.has(item.value);
                    return (
                      <label
                        key={item.value}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2.5 border bg-white px-4 py-3 text-[14px] font-semibold outline-none select-none",
                          "border-[#EBEBEB] text-[#1E1E1E]",
                          selected ? "border-[#004DE7]/20 bg-[#EEF3FF] text-[#004DE7]" : "",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selected}
                          onChange={() => toggle(item.value)}
                        />
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                            selected ? "border-[#004DE7] bg-[#004DE7]" : "border-[#D6D6D6] bg-white",
                          )}
                        >
                          {selected && (
                            <svg viewBox="0 0 6 5" fill="none" className="h-2 w-2">
                              <path d="M0.5 2.5l2 2 3-4" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.meta && <span className="shrink-0 text-xs font-normal text-[#767676]">{item.meta}</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {values.length > 0 && (
              <div className="flex items-center justify-between border-t border-[#EBEBEB] bg-white px-3 py-2 mt-1">
                <span className="text-xs text-[#767676]">{values.length} selected</span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs font-medium text-[#004DE7] hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

MultiSearchableSelect.displayName = "MultiSearchableSelect";
