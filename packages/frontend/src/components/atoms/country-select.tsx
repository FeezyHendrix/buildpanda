import { Combobox } from "@base-ui/react/combobox";
import { cn } from "@/lib/utils";
import { countries, type Country } from "@/lib/countries";

interface CountrySelectProps {
  value: Country | null;
  onChange: (country: Country | null) => void;
  className?: string;
}

function ChevronIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      {...props}
    >
      <path d="M0.5 4.5L4 1.5L7.5 4.5" />
      <path d="M0.5 7.5L4 10.5L7.5 7.5" />
    </svg>
  );
}

function CheckIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg fill="currentColor" width="10" height="10" viewBox="0 0 10 10" {...props}>
      <path d="M9.1603 1.12218C9.50684 1.34873 9.60427 1.81354 9.37792 2.16038L5.13603 8.66012C5.01614 8.8438 4.82192 8.96576 4.60451 8.99384C4.3871 9.02194 4.1683 8.95335 4.00574 8.80615L1.24664 6.30769C0.939709 6.02975 0.916013 5.55541 1.19372 5.24822C1.47142 4.94102 1.94536 4.91731 2.2523 5.19524L4.36085 7.10461L8.12299 1.33999C8.34934 0.993152 8.81376 0.895638 9.1603 1.12218Z" />
    </svg>
  );
}

function CountrySelect({ value, onChange, className }: CountrySelectProps) {
  return (
    <Combobox.Root
      items={countries}
      value={value}
      onValueChange={onChange}
      itemToStringLabel={(c) => c ? `${c.flag} ${c.name}` : ""}
    >
      <Combobox.Trigger
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg bg-[#F6F6F6] px-4 text-sm text-gray-900",
          "border-0 outline-none ring-0",
          "focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "cursor-default select-none",
          className,
        )}
      >
        <Combobox.Value>
          {(selected: Country | null) =>
            selected ? (
              <span>{selected.flag} {selected.name}</span>
            ) : (
              <span className="text-gray-400">Select country</span>
            )
          }
        </Combobox.Value>
        <Combobox.Icon className="flex shrink-0 text-gray-400">
          <ChevronIcon />
        </Combobox.Icon>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="z-[60]">
          <Combobox.Popup
            className={cn(
              "max-h-[20rem] max-w-[var(--available-width)] origin-[var(--transform-origin)]",
              "rounded-lg bg-white text-gray-900 shadow-lg shadow-gray-200/60",
              "outline outline-1 outline-gray-200",
            )}
            aria-label="Select country"
          >
            <div className="p-2">
              <Combobox.Input
                placeholder="Search countries…"
                className={cn(
                  "h-9 w-full rounded-md bg-[#F6F6F6] px-3 text-base lg:text-sm text-gray-900",
                  "border-0 outline-none ring-0",
                  "placeholder:text-gray-400",
                  "focus-visible:ring-2 focus-visible:ring-gray-900/10",
                )}
              />
            </div>

            <Combobox.Empty className="px-4 py-3 text-sm text-gray-400">
              No countries found.
            </Combobox.Empty>

            <Combobox.List className="max-h-[min(16rem,calc(var(--available-height)-3.5rem))] overflow-y-auto overscroll-contain scroll-py-1 py-1">
              {(country: Country) => (
                <Combobox.Item
                  key={country.code}
                  value={country}
                  className={cn(
                    "grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-3 py-2 text-sm outline-none select-none",
                    "data-[highlighted]:bg-[#F6F6F6]",
                  )}
                >
                  <Combobox.ItemIndicator className="col-start-1">
                    <CheckIcon className="size-2.5" />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2">
                    {country.flag} {country.name}
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

CountrySelect.displayName = "CountrySelect";

export { CountrySelect, type CountrySelectProps };
