import { useId } from "react";
import { CONSTRUCTION_UNITS } from "@/lib/construction-units";

interface UnitInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

export function UnitInput({ value, onChange, className, disabled, id, "aria-label": ariaLabel }: UnitInputProps) {
  const listId = useId();
  return (
    <>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="bags"
        className={className}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <datalist id={listId}>
        {CONSTRUCTION_UNITS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </>
  );
}

UnitInput.displayName = "UnitInput";
