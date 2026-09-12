import type { ReactNode } from "react";
import { Card } from "@/components/atoms/card";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";

const inputClass =
  "h-11 w-full rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10";
const numericInputClass = cn(inputClass, "tabular-nums pr-14");

export function TermsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card padding="lg" className="mt-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      {children}
    </Card>
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
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
        checked
          ? "border-[#004DE7] bg-[#004DE7]/5"
          : "border-gray-200 hover:border-gray-300",
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
        className="mt-1 h-4 w-4 accent-[#004DE7]"
      />
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="mt-0.5 text-xs text-gray-500">{hint}</div>
      </div>
    </label>
  );
}

RadioCard.displayName = "RadioCard";

/** A numeric input with a trailing unit (%, days, a currency code) and a hint line. */
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
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={numericInputClass}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-gray-500">
          {unit}
        </span>
      </div>
      <p className="text-xs text-gray-400">{hint}</p>
    </div>
  );
}

UnitNumberField.displayName = "UnitNumberField";
