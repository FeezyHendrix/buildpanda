import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  inputClass,
  lineAmount,
  type UpsertLineItem,
} from "./invoice-form-model";

interface LineItemsListProps {
  items: UpsertLineItem[];
  money: (n: number) => string;
  onChange: (index: number, patch: Partial<UpsertLineItem>) => void;
  onRemove: (index: number) => void;
}

export function LineItemsList({
  items,
  money,
  onChange,
  onRemove,
}: LineItemsListProps) {
  const canRemove = items.length > 1;
  return (
    <div className="flex flex-col">
      <Header />
      <ol className="flex flex-col gap-3 md:gap-0">
        {items.map((line, index) => (
          <Row
            key={index}
            index={index}
            line={line}
            money={money}
            canRemove={canRemove}
            onChange={(patch) => onChange(index, patch)}
            onRemove={() => onRemove(index)}
          />
        ))}
      </ol>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-2 hidden grid-cols-12 gap-3 border-b border-[#F0F0F0] px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 md:grid">
      <span className="col-span-4">Description</span>
      <span className="col-span-1 text-right">Qty</span>
      <span className="col-span-2">Unit</span>
      <span className="col-span-2 text-right">Rate</span>
      <span className="col-span-2 text-right">Amount</span>
      <span className="col-span-1" aria-hidden="true" />
    </div>
  );
}

interface RowProps {
  index: number;
  line: UpsertLineItem;
  canRemove: boolean;
  money: (n: number) => string;
  onChange: (patch: Partial<UpsertLineItem>) => void;
  onRemove: () => void;
}

function Row({ index, line, canRemove, money, onChange, onRemove }: RowProps) {
  const amount = lineAmount(line);
  const lineNum = index + 1;

  return (
    <li className="rounded-xl border border-[#F0F0F0] bg-[#FAFAFA] p-3 md:rounded-none md:border-0 md:border-b md:border-[#F5F5F5] md:bg-transparent md:p-2 md:last:border-b-0">
      <div className="mb-3 flex items-center justify-between md:hidden">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Line {lineNum}
        </span>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-gray-500 hover:text-error-600"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-12 gap-2 md:items-center md:gap-3">
        <input
          value={line.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Description"
          aria-label={`Line ${lineNum} description`}
          className={cn(inputClass, "col-span-12 md:col-span-4")}
        />
        <Cell span="col-span-4 md:col-span-1" label="Qty">
          <input
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
            placeholder="1"
            inputMode="decimal"
            aria-label={`Line ${lineNum} quantity`}
            className={cn(inputClass, "text-right")}
          />
        </Cell>
        <Cell span="col-span-4 md:col-span-2" label="Unit">
          <input
            value={line.unit}
            onChange={(e) => onChange({ unit: e.target.value })}
            placeholder="m²"
            aria-label={`Line ${lineNum} unit`}
            className={inputClass}
          />
        </Cell>
        <Cell span="col-span-4 md:col-span-2" label="Rate">
          <input
            value={line.unitRate}
            onChange={(e) => onChange({ unitRate: e.target.value })}
            placeholder="0.00"
            inputMode="decimal"
            aria-label={`Line ${lineNum} rate`}
            className={cn(inputClass, "text-right")}
          />
        </Cell>
        <div className="col-span-12 flex items-center justify-between border-t border-[#EEE] pt-2.5 md:col-span-2 md:justify-end md:border-0 md:pl-2 md:pt-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 md:hidden">
            Amount
          </span>
          <span className="text-sm font-semibold tabular-nums text-gray-900">
            {money(amount)}
          </span>
        </div>
        <div className="hidden md:col-span-1 md:flex md:justify-end">
          {canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove line ${lineNum}`}
              className="inline-flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-error-50 hover:text-error-600"
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

interface CellProps {
  span: string;
  label: string;
  children: ReactNode;
}

function Cell({ span, label, children }: CellProps) {
  return (
    <div className={span}>
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500 md:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
