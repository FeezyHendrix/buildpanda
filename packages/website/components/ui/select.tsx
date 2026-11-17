"use client";

import type { RefObject } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string; /** Shorter text for the closed trigger. */ short?: string };

type SelectProps = {
  options: ReadonlyArray<SelectOption>;
  value: string;
  onChange: (value: string) => void;
  /** Names the control for screen readers; there is no visible label inside the box. */
  ariaLabel: string;
  id?: string;
  className?: string;
  /** Shows a search box above the list, for lists too long to scan. */
  searchPlaceholder?: string;
  /** The box the list opens under, when that is wider than the trigger (a field group). */
  anchorRef?: RefObject<HTMLElement | null>;
};

/**
 * The app's select: a trigger that opens a list, built on the same Base UI
 * combobox as the product. The trigger is bare so it can sit inside a
 * `.field-group` next to an input; it draws no focus ring of its own, the
 * group does.
 */
export function Select({ options, value, onChange, ariaLabel, id, className, searchPlaceholder, anchorRef }: SelectProps) {
  const labels = options.map((option) => option.label);
  const selected = options.find((option) => option.value === value) ?? null;

  function handleChange(label: string | null) {
    const next = options.find((option) => option.label === label);
    if (next) onChange(next.value);
  }

  return (
    <Combobox.Root
      items={labels}
      value={selected?.label ?? null}
      onValueChange={handleChange}
      itemToStringLabel={(item) => item ?? ""}
      // Without search the list is always whole; with it the combobox filters as you type.
      {...(searchPlaceholder ? null : { filteredItems: labels })}
    >
      <Combobox.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "field-select flex h-full min-w-0 cursor-default select-none items-center justify-between gap-2 bg-transparent px-3 text-sm font-medium",
          className,
        )}
      >
        <span className="truncate">{selected?.short ?? selected?.label}</span>
        <Combobox.Icon className="flex shrink-0 text-ink-soft">
          <ChevronDownIcon className="size-3.5" />
        </Combobox.Icon>
      </Combobox.Trigger>

      <Combobox.Portal>
        {/* Always under the select: never flipped above it, and a phone keyboard cannot push it away. */}
        <Combobox.Positioner
          anchor={anchorRef}
          side="bottom"
          align="start"
          sideOffset={6}
          collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
          className="z-[60]"
        >
          <Combobox.Popup
            // On a touch screen focusing the search box would raise the keyboard and cover the list.
            initialFocus={(openType) => openType !== "touch"}
            className={cn(
              "w-[var(--anchor-width)] min-w-[15rem] max-w-[var(--available-width)] origin-[var(--transform-origin)]",
              "border border-line bg-cream p-1 shadow-lg",
            )}
          >
            {searchPlaceholder ? (
              <Combobox.Input
                placeholder="Type to search"
                aria-label={searchPlaceholder}
                // Browsers read "countries" as an address field and offer saved addresses over the list.
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                name="list-search"
                className="field-bare mb-1 h-10 w-full border border-line bg-white px-3 text-sm outline-none placeholder:text-ink-soft focus:border-brand"
              />
            ) : (
              // The combobox needs an input to exist; with no search it stays hidden.
              <Combobox.Input className="sr-only" aria-hidden tabIndex={-1} readOnly />
            )}
            {/* Takes no space while there are results; the padding only applies once it holds the message. */}
            <Combobox.Empty className="px-4 text-sm text-ink-soft empty:hidden [&:not(:empty)]:py-3">No matches.</Combobox.Empty>
            <Combobox.List className="max-h-[max(9rem,min(16rem,calc(var(--available-height)-5rem)))] space-y-1 overflow-y-auto overscroll-contain">
              {(label: string) => (
                <Combobox.Item
                  key={label}
                  value={label}
                  className={cn(
                    "field-option w-full cursor-default select-none border border-line bg-white px-4 py-3 text-sm font-medium",
                    "data-[highlighted]:border-brand/20 data-[highlighted]:bg-brand/5 data-[selected]:text-brand",
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
