import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";
import { SheetHeading } from "../contracts-phases/sheet-parts";

/**
 * The field set of the contract's Terms tab: a section with a heading and a
 * lead, radio cards, and bordered inputs whose label sits above and hint below.
 * An unset term reads "Not set" rather than looking filled in.
 */

export const FIELD_CLASS = cn(
  "h-[44px] w-full min-w-0 border border-[#EEEEEE] bg-white px-[16px] text-caption-l text-[#1E1E1E] outline-none",
  "placeholder:text-[#A3A3A3] focus:border-[#004DE7]",
  "disabled:cursor-not-allowed disabled:bg-[#FAFAFA] disabled:text-[#737373]",
);

const LABEL_CLASS = "text-caption-m font-semibold text-[#1E1E1E]";
const HINT_CLASS = "text-caption-m text-[#737373]";
const UNSET_PLACEHOLDER = "Not set";

/** A titled block of the Terms tab; every block after the first sits under a hairline. */
export function TermsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-[24px] border-t border-[#EEEEEE] pt-[26px] first:mt-0 first:border-t-0 first:pt-0">
      <SheetHeading>{title}</SheetHeading>
      {description ? <p className="mt-[6px] text-caption-m text-[#737373]">{description}</p> : null}
      <div className="mt-[18px]">{children}</div>
    </section>
  );
}

TermsSection.displayName = "TermsSection";

export function RadioCard<TValue extends string>({
  name,
  value,
  checked,
  disabled,
  onChange,
  label,
  hint,
}: {
  name: string;
  value: TValue;
  checked: boolean;
  disabled: boolean;
  onChange: (value: TValue) => void;
  label: string;
  hint: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-[69px] cursor-pointer items-center gap-[8px] border px-[12px] py-[10px] transition-colors",
        checked ? "border-[#004DE7] bg-[#F5F8FF]" : "border-[#EEEEEE] bg-white hover:border-[#D4D4D4]",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="size-[14px] shrink-0 accent-[#004DE7]"
      />
      <div className="min-w-0 flex-1">
        <div className="text-caption-l font-medium text-[#1E1E1E]">{label}</div>
        <div className="text-caption-m text-[#737373]">{hint}</div>
      </div>
    </label>
  );
}

RadioCard.displayName = "RadioCard";

/** A numeric input led by its unit (%, months, IPC, days, a currency code) with a hint line. */
export function UnitNumberField({
  id,
  label,
  value,
  onChange,
  disabled,
  unit,
  hint,
  min = 0,
  max,
  step = 1,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  unit: string;
  hint: ReactNode;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[6px]">
      <Label htmlFor={id} className={LABEL_CLASS}>{label}</Label>
      <div className="flex h-[44px] border border-[#EEEEEE] bg-white focus-within:border-[#004DE7]">
        <span className="flex shrink-0 items-center border-r border-[#EEEEEE] px-[12px] text-caption-m font-medium text-[#1E1E1E]">
          {unit}
        </span>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={UNSET_PLACEHOLDER}
          className="min-w-0 flex-1 bg-transparent px-[16px] text-caption-l tabular-nums text-[#1E1E1E] outline-none placeholder:text-[#A3A3A3] disabled:cursor-not-allowed disabled:bg-[#FAFAFA] disabled:text-[#737373]"
        />
      </div>
      <p className={HINT_CLASS}>{hint}</p>
    </div>
  );
}

UnitNumberField.displayName = "UnitNumberField";

/** A plain text or date field with the same label + hint shape as the others. */
export function TermsTextField({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
  placeholder = UNSET_PLACEHOLDER,
  type = "text",
  maxLength,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  hint: ReactNode;
  placeholder?: string;
  type?: "text" | "date";
  maxLength?: number;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[6px]">
      <Label htmlFor={id} className={LABEL_CLASS}>{label}</Label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        className={FIELD_CLASS}
      />
      <p className={HINT_CLASS}>{hint}</p>
    </div>
  );
}

TermsTextField.displayName = "TermsTextField";

export function TermsSelectField<T extends string>({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
  options,
}: {
  id: string;
  label: ReactNode;
  value: T | "";
  onChange: (value: T | "") => void;
  disabled: boolean;
  hint: ReactNode;
  options: readonly { value: T | ""; label: string }[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[6px]">
      <Label htmlFor={id} className={LABEL_CLASS}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T | "")}
          disabled={disabled}
          className={cn(FIELD_CLASS, "appearance-none pr-[40px]", value === "" && "text-[#A3A3A3]")}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-[14px] top-1/2 size-[16px] -translate-y-1/2 text-[#737373]" aria-hidden />
      </div>
      <p className={HINT_CLASS}>{hint}</p>
    </div>
  );
}

TermsSelectField.displayName = "TermsSelectField";

/** Label shared by the standalone controls in the Terms tab. */
export function TermsLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className={LABEL_CLASS}>
      {children}
    </Label>
  );
}

TermsLabel.displayName = "TermsLabel";

export const TERMS_HINT_CLASS = HINT_CLASS;
