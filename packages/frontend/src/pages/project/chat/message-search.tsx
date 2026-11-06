import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useMessageSearch } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";
import { SearchResults } from "./search-results";

const MIN_QUERY_LENGTH = 2;
const CLOSE_MS = 220;

function SearchField({
  value,
  onChange,
  autoFocus = false,
  onFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onFocus?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-[15px] top-1/2 size-[16px] -translate-y-1/2 text-[#1E1E1E]" strokeWidth={1.5} />
      <input
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder="Search Messages"
        aria-label="Search messages"
        className={cn("h-[36px] w-full appearance-none border border-[#EEEEEE] bg-white pl-[44px] text-[14px] text-[#1E1E1E] outline-none transition-colors placeholder:text-[#A5A5A5] focus:border-primary [&::-webkit-search-cancel-button]:hidden", value ? "pr-[36px]" : "pr-[12px]")}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-[6px] top-1/2 flex size-[24px] -translate-y-1/2 items-center justify-center text-[#737373] outline-none hover:text-[#1E1E1E]"
        >
          <X className="size-[14px]" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Searching messages. On desktop it is an ordinary input in the header. On a
 * phone it is just the icon; tapping it opens the field in the header itself
 * (the back button and channel name stay; only the pin and mute buttons step aside)
 * sliding in from the right, with a close button after it. It closes with that
 * button, Escape, or by choosing a result.
 */
export function MessageSearch({
  onSelect,
  mobileOpen,
  onMobileOpenChange,
}: {
  onSelect: (channelId: string) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [closing, setClosing] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useMessageSearch(debouncedQuery);
  const hasResultsPanel = debouncedQuery.trim().length >= MIN_QUERY_LENGTH;

  function clear(): void {
    setQuery("");
    setDebouncedQuery("");
  }

  function closeMobile(): void {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      onMobileOpenChange(false);
      setClosing(false);
      clear();
    }, CLOSE_MS);
  }

  function handleSelect(channelId: string): void {
    onSelect(channelId);
    setDesktopOpen(false);
    if (mobileOpen) closeMobile();
    else clear();
  }

  useEffect(() => {
    if (!desktopOpen) return;
    const onDown = (e: MouseEvent) => {
      if (desktopRef.current && !desktopRef.current.contains(e.target as Node)) setDesktopOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDesktopOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [desktopOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // closeMobile only reads `closing`, which the guard inside it already handles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileOpen]);

  return (
    <>
      <div ref={desktopRef} className="relative hidden lg:block">
        <SearchField value={query} onChange={setQuery} onFocus={() => setDesktopOpen(true)} className="w-[200px]" />
        {desktopOpen && hasResultsPanel ? (
          <div className="absolute right-0 top-full z-30 mt-2 w-96">
            <SearchResults results={results} isFetching={isFetching} onSelect={handleSelect} />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onMobileOpenChange(true)}
        aria-label="Search messages"
        className={cn("size-[36px] items-center justify-center text-[#1E1E1E] outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 lg:hidden", mobileOpen ? "hidden" : "flex items-center justify-center")}
      >
        <Search className="size-[20px]" strokeWidth={1.5} />
      </button>

      {mobileOpen ? (
        <>
          <div className="min-w-0 flex-1 overflow-hidden lg:hidden">
            <div
              className={cn(
                "flex items-center gap-[8px]",
                closing
                  ? "[animation:search-bar-out_220ms_cubic-bezier(0.4,0,1,1)_forwards]"
                  : "[animation:search-bar-in_320ms_cubic-bezier(0.22,1,0.36,1)]",
                "motion-reduce:[animation:none]",
              )}
            >
              <SearchField value={query} onChange={setQuery} autoFocus className="min-w-0 flex-1" />
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Close search"
                className="flex size-[36px] shrink-0 items-center justify-center text-[#1E1E1E] outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
              >
                <X className="size-[20px]" strokeWidth={1.5} />
              </button>
            </div>
          </div>
          {hasResultsPanel ? (
            <div className="absolute inset-x-0 top-full z-30 lg:hidden">
              <SearchResults results={results} isFetching={isFetching} onSelect={handleSelect} />
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
