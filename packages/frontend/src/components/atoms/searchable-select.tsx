import { Combobox } from "@base-ui/react/combobox";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface SearchableSelectProps {
  items: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

function ChevronIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M1 1l4 4 4-4" />
    </svg>
  );
}

function SearchIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SearchableSelect({
  items,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search",
  emptyText = "No results found.",
  className,
  disabled,
  id,
}: SearchableSelectProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;

  return (
    <Combobox.Root
      items={items as unknown as string[]}
      value={value}
      onValueChange={onChange}
      itemToStringLabel={(item) => item ?? ""}
      disabled={disabled}
    >
      <Combobox.Trigger
        id={inputId}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 bg-white px-3.5 text-[14px] text-[#1E1E1E]",
          "border border-[#EBEBEB] outline-none",
          "focus-visible:border-[#004DE7] focus-visible:ring-1 focus-visible:ring-[#004DE7]/10",
          "cursor-default select-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <Combobox.Value>
          {(selected: string | null) =>
            selected ? (
              <span>{selected}</span>
            ) : (
              <span className="text-[#B0B0B0]">{placeholder}</span>
            )
          }
        </Combobox.Value>
        <Combobox.Icon className="flex shrink-0 text-[#767676]">
          <ChevronIcon />
        </Combobox.Icon>
      </Combobox.Trigger>

      <SearchableSelectPopup
        emptyText={emptyText}
        searchPlaceholder={searchPlaceholder}
      />
    </Combobox.Root>
  );
}

function SearchableSelectPopup({
  emptyText,
  searchPlaceholder,
}: {
  emptyText: string;
  searchPlaceholder?: string;
}) {
  return (
    <Combobox.Portal>
      <Combobox.Positioner align="start" sideOffset={4} className="z-[60]">
        <Combobox.Popup
          className={cn(
            "w-[var(--anchor-width)] min-w-[200px] max-w-[var(--available-width)] origin-[var(--transform-origin)]",
            "bg-grey-50 border border-[#EBEBEB] p-1",
          )}
        >
          {/* Search input row */}
          <div className="flex items-center gap-2.5 border-b border-[#EBEBEB] bg-white px-3.5">
            <SearchIcon className="size-[18px] shrink-0 text-[#1E1E1E]" />
            <Combobox.Input
              placeholder={searchPlaceholder}
              className={cn(
                "h-11 flex-1 bg-transparent text-[14px] text-[#1E1E1E]",
                "border-0 outline-none ring-0",
                "placeholder:text-[#B0B0B0]",
              )}
            />
          </div>

          {/* Items area with gray background */}
          <div className="bg-grey-50 pt-1">
            <Combobox.Empty className="empty:hidden px-4 py-3 text-[13px] text-black-500">
              {emptyText}
            </Combobox.Empty>

            <Combobox.List className="max-h-[min(16rem,calc(var(--available-height)-5rem))] overflow-y-auto overscroll-contain space-y-1 no-scrollbar">
              {(item: string) => (
                <Combobox.Item
                  key={item}
                  value={item}
                  className={cn(
                    "w-full cursor-pointer bg-white border border-[#EBEBEB] px-4 py-3",
                    "text-[14px] font-semibold text-[#1E1E1E] outline-none select-none",
                    "data-[highlighted]:border-[#004DE7]/20 data-[highlighted]:bg-[#EEF3FF]",
                    "data-[selected]:text-[#004DE7]",
                  )}
                >
                  {item}
                </Combobox.Item>
              )}
            </Combobox.List>
          </div>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}

SearchableSelect.displayName = "SearchableSelect";

export { SearchableSelect, type SearchableSelectProps };
