import { cn } from "@/lib/utils";

interface CurrencyPickerProps {
  currencies: readonly string[];
  value: string;
  onChange: (currency: string) => void;
  className?: string;
}

function CurrencyPicker({
  currencies,
  value,
  onChange,
  className,
}: CurrencyPickerProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      {currencies.map((curr) => (
        <button
          key={curr}
          type="button"
          onClick={() => onChange(curr)}
          className={cn(
            "h-[38px] rounded-lg border px-3 text-sm font-medium transition-colors",
            "outline-none focus-visible:shadow-focus",
            value === curr
              ? "border-primary-500 bg-primary-50 text-primary-600"
              : "border-line bg-white text-ink hover:bg-surface-alt",
          )}
        >
          {curr}
        </button>
      ))}
    </div>
  );
}

CurrencyPicker.displayName = "CurrencyPicker";

export { CurrencyPicker, type CurrencyPickerProps };
