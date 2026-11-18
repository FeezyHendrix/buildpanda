import { memo } from "react";
import { FieldLabel } from "./input";
import { Text } from "./text";
import { cn } from "@/lib/utils";
/** A bare string shows as itself; an object carries a label the value cannot (a person, a reason code). */
type Option<T extends string> = T | {
    value: T;
    label: string;
};
interface OptionRowProps<T extends string> {
    label: string;
    disabled?: boolean;
    options: readonly Option<T>[];
    value: T;
    onChange: (next: T) => void;
}
function normalise<T extends string>(option: Option<T>): {
    value: T;
    label: string;
} {
    return typeof option === "string" ? { value: option, label: option } : option;
}
/**
 * The one chip-row picker: short enums (priority, status), and any list of
 * choices that fits on a form (a reviewer, a folder, a delay reason). Chips
 * wrap rather than scroll so nothing is hidden off the right edge; every
 * chip is a 44px target.
 */
function OptionRowInner<T extends string>({ label, options, value, onChange, disabled = false }: OptionRowProps<T>) {
    return (<div className="field-stack gap-2">
      <FieldLabel>{label}</FieldLabel>
      <div className="field-stack flex-row flex-wrap gap-2">
        {options.map((raw) => {
            const option = normalise(raw);
            const isActive = option.value === value;
            return (<button key={option.value} disabled={disabled} onClick={() => onChange(option.value)} role="radio" aria-checked={isActive} aria-disabled={disabled} className={cn("min-h-11 justify-center rounded-xl px-4", isActive ? "bg-primary-500" : "bg-surface-alt")} type="button">
              <Text weight="semibold" tone={isActive ? "inverse" : "secondary"} className="text-[13px]">
                {option.label}
              </Text>
            </button>);
        })}
      </div>
    </div>);
}
export const OptionRow = memo(OptionRowInner) as typeof OptionRowInner;
