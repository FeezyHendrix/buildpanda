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
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
            value === curr
              ? "bg-[#F0F4FF] text-[#004DE7]"
              : "bg-[#F6F6F6] text-gray-600 hover:bg-gray-200",
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
