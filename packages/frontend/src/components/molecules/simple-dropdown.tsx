import { Menu } from "@base-ui/react/menu";
import { FilterChevron, FILTER_TRIGGER_CLASS } from "@/components/atoms/filter-trigger";
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
 * to `FilterTabs` and `DateRangeFilter` at the same height. The list renders
 * in a portal so a scrolling table or card can never clip it.
 */
function SimpleDropdown<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SimpleDropdownProps<T>) {
  const selected = options.find((o) => o.value === value) ?? options[0]!;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={ariaLabel}
        onMouseDown={(event) => event.preventBaseUIHandler()}
        className={cn(FILTER_TRIGGER_CLASS, className)}
      >
        <span className="truncate">{selected.label}</span>
        <FilterChevron />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} className="z-[70]">
          <Menu.Popup className="min-w-[160px] rounded-lg bg-white p-1.5 shadow-lg ring-1 ring-black/5 outline-none">
            <Menu.RadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
              {options.map((opt) => (
                <Menu.RadioItem
                  key={opt.value}
                  value={opt.value}
                  className={cn(
                    "flex w-full cursor-default select-none items-center rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-gray-100",
                    opt.value === value ? "font-semibold text-gray-900" : "text-gray-700",
                  )}
                >
                  {opt.label}
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

SimpleDropdown.displayName = "SimpleDropdown";

export { SimpleDropdown, type SimpleDropdownProps, type DropdownOption };
