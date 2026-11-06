import { Select, type SelectOption } from "@/components/atoms/select";
import { cn } from "@/lib/utils";

interface UnitInputFieldProps {
  id: string;
  label: string;
  unitOptions: SelectOption[];
  unit: string;
  onUnitChange: (unit: string) => void;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: "decimal" | "numeric" | "text";
  /** Width class for the unit segment, e.g. "w-[78px]". */
  unitWidthClass?: string;
  /** Tailwind height class, 45px by default. */
  heightClass?: string;
  className?: string;
}

/**
 * A labelled amount with its unit chosen in a segment on the left ("NGN ⌄",
 * "Days ⌄"): one box, one border, so the unit reads as part of the figure.
 */
export function UnitInputField({
  id,
  label,
  unitOptions,
  unit,
  onUnitChange,
  value,
  onChange,
  placeholder,
  inputMode = "decimal",
  unitWidthClass = "w-[78px]",
  heightClass = "h-[45px]",
  className,
}: UnitInputFieldProps) {
  return (
    <div className={cn("flex flex-col gap-[5px]", className)}>
      <label htmlFor={id} className="text-[12px] font-semibold leading-[16px] text-[#1E1E1E]">
        {label}
      </label>
      <div className={cn("flex border border-[#EEEEEE] bg-white focus-within:border-primary", heightClass)}>
        <Select
          options={unitOptions}
          value={unit}
          onChange={(next) => onUnitChange(next ?? unit)}
          className={cn("h-full shrink-0 border-0 border-r border-[#EEEEEE] px-[15px] text-[14px] font-semibold", unitWidthClass)}
        />
        <input
          id={id}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-white px-[15px] text-[14px] text-[#1E1E1E] outline-none placeholder:text-[#A5A5A5]"
        />
      </div>
    </div>
  );
}

UnitInputField.displayName = "UnitInputField";
