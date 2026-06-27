import { useCallback, useMemo, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string;
  onChange: (rawValue: string) => void;
  currencySymbol?: string;
}

function formatWithDelimiters(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [integerPart, decimalPart] = cleaned.split(".");
  if (!integerPart) return cleaned;
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimalPart !== undefined ? `${grouped}.${decimalPart}` : grouped;
}

function stripDelimiters(display: string): string {
  return display.replace(/,/g, "");
}

export function MoneyInput({
  value,
  onChange,
  currencySymbol,
  className,
  ...props
}: MoneyInputProps) {
  const displayValue = useMemo(() => formatWithDelimiters(value), [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = stripDelimiters(e.target.value).replace(/[^0-9.]/g, "");
      const dots = raw.split(".").length - 1;
      if (dots > 1) return;
      onChange(raw);
    },
    [onChange],
  );

  return (
    <div className="relative">
      {currencySymbol && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-gray-500">
          {currencySymbol}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        className={cn(
          "flex h-11 w-full rounded-lg bg-[#F6F6F6] px-4 font-sans text-base lg:text-sm text-gray-900",
          "border-0 outline-none ring-0",
          "placeholder:text-gray-400",
          "focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "text-right tabular-nums",
          currencySymbol && "pl-9",
          className,
        )}
        {...props}
      />
    </div>
  );
}
