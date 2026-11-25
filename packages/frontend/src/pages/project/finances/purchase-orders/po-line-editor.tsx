import { MoneyInput } from "@/components/atoms/money-input";
import { Select } from "@/components/atoms/select";
import { DRAWER_FIELD_CLASS } from "@/components/molecules/drawer-fields";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { lineTotal, type LineItemValues } from "./purchase-order-model";
import { AddImageButton, FileLink, LinesBand } from "./po-parts";

/** Units a line can be ordered in. Held on the form: the API has no unit field yet. */
const UNIT_OPTIONS = ["Bags", "Tonnes", "Kg", "m", "m²", "m³", "Litres", "Nr", "Lot", "Hours", "Days"].map((unit) => ({ value: unit, label: unit }));

/** Column templates: the band's text sits 4px left of the inputs, as in the design. */
const BAND_COLUMNS = "357px 85px 163px 162px 1fr";
const ROW_COLUMNS = "362px 85px 163px 161px 1fr";
const BAND_LABELS = ["Description", "QTY", "Unit", "Rate", "Amount"] as const;

const FIELD = cn(DRAWER_FIELD_CLASS, "w-full");

interface LineEditorProps {
  items: LineItemValues[];
  currency: string;
  onChange: (index: number, patch: Partial<LineItemValues>) => void;
  onRemove: (index: number) => void;
}

function LineRow({ item, index, currency, canRemove, onChange, onRemove }: {
  item: LineItemValues;
  index: number;
  currency: string;
  canRemove: boolean;
  onChange: LineEditorProps["onChange"];
  onRemove: LineEditorProps["onRemove"];
}) {
  return (
    <div className="pl-[20px] pt-[24px]">
      <div className="grid items-center" style={{ gridTemplateColumns: ROW_COLUMNS }}>
        <input
          aria-label={`Line ${index + 1} description`}
          value={item.description}
          onChange={(event) => onChange(index, { description: event.target.value })}
          placeholder="e.g. Cement bags"
          maxLength={500}
          className={cn(FIELD, "w-[335px]")}
        />
        <input
          aria-label={`Line ${index + 1} quantity`}
          type="number"
          inputMode="decimal"
          min={0.01}
          step="0.01"
          value={item.quantity}
          onChange={(event) => onChange(index, { quantity: event.target.value })}
          placeholder="100"
          className={cn(FIELD, "w-[60px] px-[8px] text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none")}
        />
        <div className="w-[137px]">
          <Select
            options={UNIT_OPTIONS}
            value={item.unit || null}
            onChange={(unit) => onChange(index, { unit: unit ?? "" })}
            placeholder="Select type"
            className="h-[45px] border-[#EEEEEE] px-[16px] text-caption-l"
            iconClassName="text-[#A3A3A3]"
          />
        </div>
        <div className="h-[45px] w-[137px] border border-[#EEEEEE] bg-white focus-within:border-[#004DE7] [&>div]:h-full">
          <MoneyInput
            id={`po-line-rate-${index}`}
            value={item.unitPrice}
            onChange={(unitPrice) => onChange(index, { unitPrice })}
            placeholder="0.00"
            className="h-full w-full rounded-none bg-transparent px-[16px] text-left text-caption-l text-[#1E1E1E] outline-none placeholder:text-[#B0B0B0] lg:text-caption-l"
          />
        </div>
        <p className="truncate pr-[8px] text-caption-l tabular-nums text-[#1E1E1E]">{formatCurrency(lineTotal(item), currency)}</p>
      </div>

      <div className="mt-[16px] flex flex-wrap items-center gap-x-[16px] gap-y-[8px]">
        <AddImageButton onFiles={(files) => onChange(index, { images: [...item.images, ...files] })} />
        {item.images.map((file, imageIndex) => (
          <FileLink
            key={`${file.name}-${imageIndex}`}
            file={file}
            onRemove={() => onChange(index, { images: item.images.filter((_, i) => i !== imageIndex) })}
          />
        ))}
        {canRemove ? (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="ml-auto pr-[20px] text-caption-l font-medium text-error-600 outline-none hover:underline focus-visible:underline"
          >
            Remove line
          </button>
        ) : null}
      </div>
    </div>
  );
}

LineRow.displayName = "LineRow";

/** The editable lines: a grey column band over one block per line (fields, then its images). */
export function PoLineEditor({ items, currency, onChange, onRemove }: LineEditorProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[940px]">
        <LinesBand columns={BAND_COLUMNS} labels={BAND_LABELS} />
        {items.map((item, index) => (
          <LineRow
            key={index}
            item={item}
            index={index}
            currency={currency}
            canRemove={items.length > 1}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}

PoLineEditor.displayName = "PoLineEditor";
