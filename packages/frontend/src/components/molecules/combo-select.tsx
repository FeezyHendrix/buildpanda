import { useMemo } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { INPUT_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

export interface ComboItem {
  id: string;
  label: string;
  group?: string;
}

export function ComboSelect({
  items,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  className,
}: {
  items: ComboItem[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const labelOf = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, i.label]));
    return (id: string | null) => (id ? (map.get(id) ?? id) : "");
  }, [items]);

  return (
    <Combobox.Root
      items={ids}
      value={value}
      onValueChange={onChange}
      itemToStringLabel={(id) => labelOf(id)}
    >
      <Combobox.Trigger
        className={cn(
          INPUT_CLASS,
          "flex items-center justify-between gap-2 text-left",
          "cursor-default select-none",
          className,
        )}
      >
        <Combobox.Value>
          {(selected: string | null) =>
            selected ? (
              <span className="truncate">{labelOf(selected)}</span>
            ) : (
              <span className="text-ink-muted">{placeholder}</span>
            )
          }
        </Combobox.Value>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-[22px] shrink-0 text-ink-muted"><path d="m6 9 6 6 6-6" /></svg>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="z-50">
          <Combobox.Popup className="z-50 max-h-72 w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-line bg-white py-2 shadow-card">
            <div className="px-2 pb-2">
              <Combobox.Input
                placeholder={searchPlaceholder}
                className="h-[38px] w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-500 focus:shadow-focus"
              />
            </div>
            <Combobox.Empty className="px-3 py-2 text-sm text-ink-muted">
              {emptyText}
            </Combobox.Empty>
            <Combobox.List>
              {(id: string) => {
                const item = items.find((i) => i.id === id);
                return (
                  <Combobox.Item
                    key={id}
                    value={id}
                    className="flex cursor-default items-center justify-between px-3 py-2 text-sm text-ink data-[highlighted]:bg-black/5 data-[selected]:bg-black/5"
                  >
                    <span className="truncate">{item?.label ?? id}</span>
                    {item?.group && (
                      <span className="ml-2 shrink-0 text-[10px] uppercase text-ink-muted">
                        {item.group}
                      </span>
                    )}
                  </Combobox.Item>
                );
              }}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

ComboSelect.displayName = "ComboSelect";
