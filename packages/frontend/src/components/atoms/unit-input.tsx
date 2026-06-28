import { CONSTRUCTION_UNITS } from "@/lib/construction-units";
import { SearchableSelect } from "@/components/atoms/searchable-select";

interface UnitInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function UnitInput({ value, onChange, className, disabled, id }: UnitInputProps) {
  return (
    <SearchableSelect
      id={id}
      items={CONSTRUCTION_UNITS}
      value={value || null}
      onChange={(v) => onChange(v ?? "")}
      placeholder="Select unit…"
      searchPlaceholder="Search units…"
      emptyText="No matching unit."
      className={className}
      disabled={disabled}
    />
  );
}

UnitInput.displayName = "UnitInput";
