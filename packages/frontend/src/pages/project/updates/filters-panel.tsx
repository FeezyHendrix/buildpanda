import { Avatar } from "@/components/atoms/avatar";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { cn } from "@/lib/utils";
import type { Person, UpdateCategory } from "@/lib/project-types";

export type CategoryFilter = "All" | UpdateCategory;

export const CATEGORY_FILTERS: CategoryFilter[] = [
  "All",
  "Progress",
  "Material Delivery",
  "Inspections",
  "Issues",
];

export interface FilterState {
  category: CategoryFilter;
  contractor: string | null;
  dateFrom: string;
  dateTo: string;
}

export const INITIAL_FILTERS: FilterState = {
  category: "All",
  contractor: null,
  dateFrom: "",
  dateTo: "",
};

export interface FiltersPanelProps {
  filters: FilterState;
  contractors: Pick<Person, "id" | "name" | "role">[];
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
}

export function FiltersPanel({ filters, contractors, onChange }: FiltersPanelProps) {
  return (
    <aside className="h-fit lg:sticky lg:top-24 rounded-[16px] bg-[#F8F8F8] flex flex-col">
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <ReactSVG src={icons.filter} />
          <h3 className="text-[13px] font-semibold text-black-300">Filter Menu</h3>
        </div>
      </div>

      <div className="bg-white rounded-[12px] h-full m-1 p-6 flex flex-col gap-4">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            By Categories
          </h3>
          <div className="flex flex-wrap gap-4">
            {CATEGORY_FILTERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange("category", c)}
                className={cn(
                  "flex items-center justify-between rounded-[15px] px-[10px] py-[4px] text-[13px] h-[24px] bg-[#F6F6F6] transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 cursor-pointer",
                  filters.category === c
                    ? "bg-primary-50 font-semibold text-primary"
                    : "text-black-300 hover:bg-primary-50 hover:text-primary",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className='border-t border-[#F6F6F6] pt-6'>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            By Contractors
          </h3>
          <div className="flex flex-col gap-1">
            {contractors.map((c) => (
              <RadioRow
                key={c.id}
                label={c.name}
                sublabel={c.role}
                checked={filters.contractor === c.id}
                onChange={() => onChange("contractor", c.id)}
              />
            ))}
          </div>
        </div>

        <div className='border-t border-[#F6F6F6] pt-6'>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            By Date Range
          </h3>
          <div className="flex flex-row justify-between items-center">
            <DateField
              value={filters.dateFrom}
              onChange={(v) => onChange("dateFrom", v)}
            />
            <span>-</span>
            <DateField
              value={filters.dateTo}
              onChange={(v) => onChange("dateTo", v)}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

interface RadioRowProps {
  label: string;
  img?: string;
  sublabel?: string;
  checked: boolean;
  onChange: () => void;
}

function RadioRow({ label, img, sublabel, checked, onChange }: RadioRowProps) {
  return (
    <label
      className={cn(
        "flex justify-between cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[#F6F6F6]",
        checked && "bg-[#F6F6F6]",
      )}
    >
      <div className='flex gap-2'>
        <Avatar
          name={label}
          src={img}
          size="md"
          className={cn("h-[34px] w-[34px] rounded-[8px]")}
        />
        <span className="min-w-0">
          <span className="block truncate text-[13px] text-[#131B2E]">
            {label}
          </span>
          {sublabel && (
            <span className="block truncate text-[11px] text-black-300">
              {sublabel}
            </span>
          )}
        </span>
      </div>
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-[#004DE7]" : "border-gray-300",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-[#004DE7]" />}
      </span>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900",
          "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
        )}
      />
    </label>
  );
}
