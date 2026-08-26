import { Button } from "@/components";
import { TextInput } from "@/components/atoms/text-input";
import type { UpdateCategory } from "@/lib/project-types";

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
  dateFrom: string;
  dateTo: string;
}

export const INITIAL_FILTERS: FilterState = {
  category: "All",
  dateFrom: "",
  dateTo: "",
};

export interface FiltersPanelProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onApply: () => void;
  onReset: () => void;
}

export function FiltersPanel({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onApply,
  onReset,
}: FiltersPanelProps) {
  return (
    <div className="flex flex-col gap-4 bg-white p-5 border border-border">
      <h3 className="text-[15px] font-semibold text-[#131B2E]">Filter</h3>

      <TextInput
        label="From"
        type="date"
        value={dateFrom}
        onChange={onDateFromChange}
      />
      <TextInput
        label="To"
        type="date"
        value={dateTo}
        onChange={onDateToChange}
      />

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          size="md"
          onClick={onApply}
          disabled={!dateFrom && !dateTo}
        >
          Apply Filter
        </Button>
        <Button size="md" type="button" variant="ghost" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
