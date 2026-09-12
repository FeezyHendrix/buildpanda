import { useCallback, useMemo, type InputHTMLAttributes } from "react";
import { INPUT_CLASS } from "@/components/atoms/input";
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
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-ink-muted">
          {currencySymbol}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        className={cn(
          INPUT_CLASS,
          "text-right tabular-nums",
          currencySymbol && "pl-9",
          className,
        )}
        {...props}
      />
    </div>
  );
}
