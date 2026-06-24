import { useMemo } from "react";
import { Combobox } from "@base-ui-components/react/combobox";
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
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900",
          "border-0 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "cursor-default select-none",
          className,
        )}
      >
        <Combobox.Value>
          {(selected: string | null) =>
            selected ? (
              <span className="truncate">{labelOf(selected)}</span>
            ) : (
              <span className="text-gray-400">{placeholder}</span>
            )
          }
        </Combobox.Value>
        <span className="text-gray-400">▾</span>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="z-50">
          <Combobox.Popup className="z-50 max-h-72 w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            <div className="p-1">
              <Combobox.Input
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-md bg-[#F6F6F6] px-2 text-sm outline-none"
              />
            </div>
            <Combobox.Empty className="px-3 py-2 text-sm text-gray-400">
              {emptyText}
            </Combobox.Empty>
            <Combobox.List>
              {(id: string) => {
                const item = items.find((i) => i.id === id);
                return (
                  <Combobox.Item
                    key={id}
                    value={id}
                    className="flex cursor-default items-center justify-between rounded-md px-3 py-2 text-sm text-gray-700 data-[highlighted]:bg-[#F6F6F6] data-[highlighted]:text-gray-900"
                  >
                    <span className="truncate">{item?.label ?? id}</span>
                    {item?.group && (
                      <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-gray-400">
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
