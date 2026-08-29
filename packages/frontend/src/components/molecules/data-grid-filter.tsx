import { useId, useMemo, useState, type ChangeEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import { Badge } from "@/components/atoms/badge";
import { cn } from "@/lib/utils";

/** The plain, comparable value a column yields for search, sort and filtering. */
type DataGridValue = string | number | null;

interface DataGridFilterOption {
  value: string;
  label: string;
}

/**
 * `select` renders a checkbox multi-select; omit `options` to derive the
 * distinct values from the data. `date` renders an inclusive from/to range and
 * expects the accessor to yield a date.
 */
type DataGridFilter =
  | { kind: "select"; options?: readonly DataGridFilterOption[] }
  | { kind: "date" };

type DataGridFilterValue =
  | { kind: "select"; values: ReadonlySet<string> }
  | { kind: "date"; from: string; to: string };

const OPTION_SEARCH_THRESHOLD = 8;
const ISO_DAY_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

const EMPTY_SELECT_VALUE: DataGridFilterValue = {
  kind: "select",
  values: new Set<string>(),
};
const EMPTY_DATE_VALUE: DataGridFilterValue = { kind: "date", from: "", to: "" };

function emptyFilterValue(kind: DataGridFilter["kind"]): DataGridFilterValue {
  return kind === "select" ? EMPTY_SELECT_VALUE : EMPTY_DATE_VALUE;
}

function filterValueCount(value: DataGridFilterValue | undefined): number {
  if (!value) return 0;
  if (value.kind === "select") return value.values.size;
  return (value.from ? 1 : 0) + (value.to ? 1 : 0);
}

function isFilterValueActive(value: DataGridFilterValue | undefined): boolean {
  return filterValueCount(value) > 0;
}

/**
 * ISO-prefixed strings are sliced rather than parsed: `new Date("2026-03-14")`
 * is UTC midnight, so reading local calendar fields would shift the day west
 * of Greenwich.
 */
function toDayKey(value: DataGridValue): string | null {
  if (value === null) return null;
  if (typeof value === "string") {
    const iso = ISO_DAY_PREFIX.exec(value);
    if (iso) return iso[1] ?? null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function matchesFilterValue(
  raw: DataGridValue,
  filter: DataGridFilterValue,
): boolean {
  if (filter.kind === "select") {
    return filter.values.has(raw === null ? "" : String(raw));
  }
  const day = toDayKey(raw);
  if (day === null) return false;
  if (filter.from && day < filter.from) return false;
  if (filter.to && day > filter.to) return false;
  return true;
}

function FunnelIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.75 2.5h10.5L8.2 7.3v4.05L5.8 12.25V7.3L1.75 2.5Z" />
    </svg>
  );
}

FunnelIcon.displayName = "FunnelIcon";

const popupClass = cn(
  "w-64 origin-top rounded-xl border border-grey-50 bg-white p-1.5 shadow-lg outline-none",
  "animate-fade-in",
);
const clearButtonClass = cn(
  "rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-primary-500",
  "outline-none hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-gray-900/10",
  "disabled:pointer-events-none disabled:opacity-40",
);
const fieldClass = cn(
  "h-9 w-full rounded-lg bg-[#F6F6F6] px-2.5 text-xs text-gray-900",
  "outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10",
);

function SelectFilterPanel({
  options,
  values,
  onChange,
}: {
  options: readonly DataGridFilterOption[];
  values: ReadonlySet<string>;
  onChange: (next: DataGridFilterValue) => void;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  }, [options, query]);

  function toggle(value: string): void {
    const next = new Set(values);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange({ kind: "select", values: next });
  }

  return (
    <>
      {options.length > OPTION_SEARCH_THRESHOLD ? (
        <div className="px-1 pb-1.5">
          <input
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setQuery(event.target.value)
            }
            placeholder="Find an option"
            className={fieldClass}
          />
        </div>
      ) : null}

      <div className="max-h-56 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-gray-400">
            No options
          </p>
        ) : (
          visible.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex select-none items-center gap-2.5 rounded-lg px-2 py-1.5",
                "text-sm text-gray-700 hover:bg-[#F6F6F6]",
              )}
            >
              <input
                type="checkbox"
                checked={values.has(option.value)}
                onChange={() => toggle(option.value)}
                className="size-3.5 shrink-0 rounded"
              />
              <span className="truncate">{option.label}</span>
            </label>
          ))
        )}
      </div>
    </>
  );
}

SelectFilterPanel.displayName = "SelectFilterPanel";

function DateFilterPanel({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: DataGridFilterValue) => void;
}) {
  const fieldId = useId();

  return (
    <div className="flex flex-col gap-2 px-1 pb-1">
      <div>
        <label
          htmlFor={`${fieldId}-from`}
          className="mb-1 block text-[11px] font-medium text-gray-500"
        >
          From
        </label>
        <input
          id={`${fieldId}-from`}
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange({ kind: "date", from: event.target.value, to })
          }
          className={fieldClass}
        />
      </div>
      <div>
        <label
          htmlFor={`${fieldId}-to`}
          className="mb-1 block text-[11px] font-medium text-gray-500"
        >
          To
        </label>
        <input
          id={`${fieldId}-to`}
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange({ kind: "date", from, to: event.target.value })
          }
          className={fieldClass}
        />
      </div>
    </div>
  );
}

DateFilterPanel.displayName = "DateFilterPanel";

interface DataGridFilterPopoverProps {
  label: string;
  filter: DataGridFilter;
  /** Choices for a `select` filter: the column's own list, or values derived from the data. */
  options: readonly DataGridFilterOption[];
  value: DataGridFilterValue | undefined;
  onChange: (next: DataGridFilterValue) => void;
}

function DataGridFilterPopover({
  label,
  filter,
  options,
  value,
  onChange,
}: DataGridFilterPopoverProps) {
  const count = filterValueCount(value);
  const active = count > 0;

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={
          active ? `Filter by ${label} (${count} active)` : `Filter by ${label}`
        }
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md p-1 outline-none transition-colors",
          "hover:bg-white focus-visible:ring-2 focus-visible:ring-gray-900/10",
          active
            ? "bg-white text-primary-500"
            : "text-gray-400 hover:text-gray-600",
        )}
      >
        <FunnelIcon />
        {active ? (
          <Badge tone="info" size="sm" className="h-4 px-1.5 text-[10px]">
            {count}
          </Badge>
        ) : null}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          className="z-50"
        >
          <Popover.Popup className={popupClass}>
            <div className="flex items-center justify-between gap-2 px-1.5 pb-1.5 pt-1">
              <Popover.Title className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {label}
              </Popover.Title>
              <button
                type="button"
                disabled={!active}
                onClick={() => onChange(emptyFilterValue(filter.kind))}
                className={clearButtonClass}
              >
                Clear
              </button>
            </div>

            {filter.kind === "select" ? (
              <SelectFilterPanel
                options={options}
                values={
                  value?.kind === "select" ? value.values : new Set<string>()
                }
                onChange={onChange}
              />
            ) : (
              <DateFilterPanel
                from={value?.kind === "date" ? value.from : ""}
                to={value?.kind === "date" ? value.to : ""}
                onChange={onChange}
              />
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

DataGridFilterPopover.displayName = "DataGridFilterPopover";

export {
  DataGridFilterPopover,
  emptyFilterValue,
  filterValueCount,
  isFilterValueActive,
  matchesFilterValue,
  toDayKey,
  type DataGridFilter,
  type DataGridFilterOption,
  type DataGridFilterPopoverProps,
  type DataGridFilterValue,
  type DataGridValue,
};
