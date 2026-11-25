import { MoneyInput } from "@/components/atoms/money-input";
import { Select } from "@/components/atoms/select";

/**
 * The look of the 430px form drawers (record funding, add/edit contract): a
 * 12px semibold label, 45px square-cornered fields and a currency-led amount.
 */

export const DRAWER_LABEL_CLASS = "text-caption-m font-semibold text-[#1E1E1E]";

export const DRAWER_FIELD_CLASS =
  "h-[45px] w-full min-w-0 border border-[#EEEEEE] bg-white px-[16px] text-caption-l text-[#1E1E1E] outline-none placeholder:text-[#B0B0B0] focus:border-[#004DE7] disabled:bg-[#FAFAFA] disabled:text-[#737373]";

interface CurrencyAmountFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  /** The symbol shown in the currency segment (₦). */
  symbol: string;
  autoFocus?: boolean;
}

/** `₦ ⌄ | 0.00` — a project is in one currency, so the segment names it rather than offering a choice. */
export function CurrencyAmountField({ id, value, onChange, currency, symbol, autoFocus }: CurrencyAmountFieldProps) {
  return (
    <div className="flex h-[45px] border border-[#EEEEEE] bg-white focus-within:border-[#004DE7]">
      <div className="w-[58px] shrink-0 border-r border-[#EEEEEE]">
        <Select
          options={[{ value: currency, label: symbol }]}
          value={currency}
          onChange={() => undefined}
          className="h-full border-0 bg-transparent px-[12px] font-semibold focus-visible:ring-0"
        />
      </div>
      <div className="min-w-0 flex-1 [&>div]:h-full">
        <MoneyInput
          id={id}
          value={value}
          onChange={onChange}
          placeholder="0.00"
          autoFocus={autoFocus}
          className="h-full w-full rounded-none bg-transparent px-[16px] text-left text-caption-l text-[#1E1E1E] outline-none placeholder:text-[#B0B0B0] lg:text-caption-l"
        />
      </div>
    </div>
  );
}

CurrencyAmountField.displayName = "CurrencyAmountField";
