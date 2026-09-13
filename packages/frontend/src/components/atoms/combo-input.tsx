import { Combobox } from "@base-ui/react/combobox";
import { useId, useRef } from "react";
import { cn } from "@/lib/utils";

interface ComboInputProps {
  items: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

function CaretDownIcon(props: React.ComponentProps<"svg">) {
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
      <path d="M1 1L5 5L9 1" />
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

/** Free-text input with suggestions: typed values not in `items` are committed as the value. */
function ComboInput({
  items,
  value,
  onChange,
  placeholder = "Select or type…",
  emptyText = "Keep typing to use a custom value.",
  className,
  disabled,
  id,
}: ComboInputProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <Combobox.Root
      items={items as unknown as string[]}
      value={value}
      onValueChange={onChange}
      inputValue={value ?? ""}
      onInputValueChange={(next, { reason }) => {
        if (reason === "item-press") return;
        onChange(next === "" ? null : next);
      }}
      itemToStringLabel={(item) => item ?? ""}
      disabled={disabled}
    >
      <div
        ref={anchorRef}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-lg bg-[#F6F6F6] px-4 text-sm text-gray-900",
          "focus-within:ring-2 focus-within:ring-gray-900/10",
          className,
        )}
      >
        <Combobox.Input
          id={inputId}
          placeholder={placeholder}
          className="h-full w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
        />
        <Combobox.Trigger
          aria-label="Show options"
          className="flex shrink-0 cursor-default text-gray-400"
        >
          <CaretDownIcon />
        </Combobox.Trigger>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner
          anchor={anchorRef}
          align="start"
          sideOffset={4}
          className="z-[60]"
        >
          <Combobox.Popup
            className={cn(
              "w-[var(--anchor-width)] max-h-[20rem] origin-[var(--transform-origin)]",
              "rounded-lg bg-white text-gray-900 shadow-lg shadow-gray-200/60",
              "outline outline-1 outline-gray-200",
            )}
          >
            <Combobox.Empty className="px-4 py-2 text-sm text-gray-400">
              {emptyText}
            </Combobox.Empty>

            <Combobox.List className="max-h-[min(16rem,calc(var(--available-height)-3.5rem))] overflow-y-auto overscroll-contain scroll-py-1 py-1">
              {(item: string) => (
                <Combobox.Item
                  key={item}
                  value={item}
                  className={cn(
                    "grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 px-3 py-2 text-sm outline-none select-none",
                    "data-[highlighted]:bg-[#F6F6F6]",
                  )}
                >
                  <Combobox.ItemIndicator className="col-start-1">
                    <CheckIcon className="size-2.5" />
                  </Combobox.ItemIndicator>
                  <span className="col-start-2">{item}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

ComboInput.displayName = "ComboInput";

export { ComboInput, type ComboInputProps };
