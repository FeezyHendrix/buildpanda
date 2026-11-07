import { cn } from "@/lib/utils";

/** The status views of the list as outlined pills; the chosen one is filled blue. */
export function RfiStatusPills<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" aria-label="Filter RFIs" className="flex flex-wrap items-center gap-[10px]">
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "h-[36px] rounded-full border px-[15px] text-[14px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10",
              selected
                ? "border-primary bg-primary text-white"
                : "border-[#EEEEEE] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]",
            )}
          >
            {item.label}
            {item.count !== undefined ? <span className="ml-1 opacity-70">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

RfiStatusPills.displayName = "RfiStatusPills";
