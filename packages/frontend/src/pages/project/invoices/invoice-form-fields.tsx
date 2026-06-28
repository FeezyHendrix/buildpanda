import { type ReactNode } from "react";
import { Label } from "@/components/atoms/label";
import { cn } from "@/lib/utils";
import { inputClass } from "./invoice-form-model";

interface FieldShellProps {
  id: string;
  label: string;
  span?: string;
  hideLabel?: boolean;
  children: ReactNode;
}

function FieldShell({ id, label, span, hideLabel, children }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", span)}>
      <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
      </Label>
      {children}
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  span?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "email" | "date";
  inputMode?: "decimal" | "text";
  autoFocus?: boolean;
}

export function TextField({
  id,
  label,
  span,
  value,
  onChange,
  placeholder,
  maxLength,
  type = "text",
  inputMode,
  autoFocus,
}: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} span={span}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoFocus={autoFocus}
        className={inputClass}
      />
    </FieldShell>
  );
}

interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  span?: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
}

export function SelectField<T extends string>({
  id,
  label,
  span,
  value,
  onChange,
  options,
}: SelectFieldProps<T>) {
  return (
    <FieldShell id={id} label={label} span={span}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={inputClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface TextareaFieldProps {
  id: string;
  label: string;
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}

export function TextareaField({
  id,
  label,
  hideLabel,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 4,
}: TextareaFieldProps) {
  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={cn(inputClass, "h-auto min-h-[112px] py-3")}
      />
    </FieldShell>
  );
}

interface SectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Section({ title, description, action, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-[#F0F0F0] bg-white p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-gray-500 text-pretty">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
