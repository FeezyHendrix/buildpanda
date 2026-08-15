import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

function Select({
  options,
  value,
  onChange,
  placeholder = "Select…",
  className,
  disabled,
  id,
}: SelectProps) {
  const labels = options.map((o) => o.label);
  const labelToValue = Object.fromEntries(options.map((o) => [o.label, o.value]));
  const valueToLabel = Object.fromEntries(options.map((o) => [o.value, o.label]));

  const selectedLabel = value ? (valueToLabel[value] ?? null) : null;

  function handleChange(label: string | null) {
    onChange(label != null ? (labelToValue[label] ?? null) : null);
  }

  return (
    <Combobox.Root
      items={labels}
      value={selectedLabel}
      onValueChange={handleChange}
      itemToStringLabel={(item) => item ?? ""}
      disabled={disabled}
      filteredItems={labels}
    >
      <Combobox.Trigger
        id={id}
        className={cn(
          "flex h-11 w-full min-w-0 items-center justify-between gap-2 bg-white px-3.5 text-[14px] text-[#1E1E1E]",
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
          <ChevronDown className='size-3' />
        </Combobox.Icon>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="z-[60]">
          <Combobox.Popup
            className={cn(
              "w-[var(--anchor-width)] min-w-[120px] max-w-[var(--available-width)] origin-[var(--transform-origin)]",
              "bg-grey-50 border border-[#EBEBEB] p-1",
            )}
          >
            {/* Visually hidden input required by Combobox — no search UX exposed */}
            <Combobox.Input className="sr-only" aria-hidden tabIndex={-1} readOnly />

            <Combobox.List className="max-h-[min(16rem,calc(var(--available-height)-3rem))] overflow-y-auto overscroll-contain space-y-1 no-scrollbar">
              {(label: string) => (
                <Combobox.Item
                  key={label}
                  value={label}
                  className={cn(
                    "w-full cursor-default bg-white border border-[#EBEBEB] px-4 py-3",
                    "text-[14px] font-semibold text-[#1E1E1E] outline-none select-none",
                    "data-[highlighted]:border-[#004DE7]/20 data-[highlighted]:bg-[#EEF3FF]",
                    "data-[selected]:text-[#004DE7]",
                  )}
                >
                  {label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

Select.displayName = "Select";

export { Select, type SelectProps };
