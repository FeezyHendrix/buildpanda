import { CONSTRUCTION_UNITS } from "@/lib/construction-units";
import { ComboInput } from "@/components/atoms/combo-input";

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
    <ComboInput
      id={id}
      items={CONSTRUCTION_UNITS}
      value={value || null}
      onChange={(v) => onChange(v ?? "")}
      placeholder="Select or type unit…"
      emptyText="Press to use a custom unit."
      className={className}
      disabled={disabled}
    />
  );
}

UnitInput.displayName = "UnitInput";
