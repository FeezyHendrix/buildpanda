import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { UnitInput } from "@/components/atoms/unit-input";
import { useCreatePreconRow } from "@/hooks/use-precon";
import {
  PRECON_PRICED_ROW_TYPES,
  type CreateRowInput,
  type PreconRowType,
} from "@/api/precon";

const ROW_TYPE_OPTIONS: { value: PreconRowType; label: string }[] = [
  { value: "item", label: "Item" },
  { value: "provisional_sum", label: "Provisional sum" },
  { value: "heading", label: "Heading" },
  { value: "work_section", label: "Work section" },
  { value: "spec_note", label: "Spec note" },
];

const FIELD_CLASS =
  "h-8 w-full rounded-lg border-0 bg-[#F6F6F6] px-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100";

interface Props {
  sessionId: string;
  billId: string;
  onError: (message: string) => void;
}

function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function PreconRowComposer({ sessionId, billId, onError }: Props) {
  const createRow = useCreatePreconRow(sessionId);
  const [open, setOpen] = useState(false);
  const [rowType, setRowType] = useState<PreconRowType>("item");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("m2");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");

  const priced = PRECON_PRICED_ROW_TYPES.includes(rowType);

  function reset(): void {
    setRowType("item");
    setDescription("");
    setCode("");
    setUnit("m2");
    setQty("");
    setRate("");
  }

  function submit(): void {
    const trimmed = description.trim();
    if (trimmed === "") return;
    const input: CreateRowInput = { rowType, description: trimmed };
    if (code.trim() !== "") input.code = code.trim();
    if (priced) {
      if (unit.trim() !== "") input.unit = unit.trim();
      const parsedQty = parseOptionalNumber(qty);
      const parsedRate = parseOptionalNumber(rate);
      if (parsedQty !== undefined) input.qty = parsedQty;
      if (parsedRate !== undefined) input.rate = parsedRate;
    }
    createRow.mutate(
      { billId, input },
      {
        onSuccess: () => {
          reset();
          setOpen(false);
        },
        onError: (error) =>
          onError(error instanceof Error ? error.message : "Could not add the row"),
      },
    );
  }

  if (!open) {
    return (
      <div className="px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <span aria-hidden className="text-sm leading-none">
            +
          </span>
          Add row
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-l-2 border-primary-600 bg-primary-50/40 px-3 py-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-500">
          Type
          <select
            className={FIELD_CLASS}
            value={rowType}
            onChange={(e) => setRowType(e.target.value as PreconRowType)}
          >
            {ROW_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Code
          <input
            className={FIELD_CLASS}
            value={code}
            placeholder="optional"
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
      </div>

      <label className="block text-xs text-gray-500">
        Description
        <input
          autoFocus
          className={FIELD_CLASS}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </label>

      {priced ? (
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-gray-500">
            Qty
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-500">
            Unit
            <UnitInput value={unit} onChange={setUnit} className={FIELD_CLASS} />
          </label>
          <label className="text-xs text-gray-500">
            Rate (₦)
            <input
              className={FIELD_CLASS}
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          size="sm"
          loading={createRow.isPending}
          disabled={description.trim() === ""}
          onClick={submit}
        >
          Add row
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
PreconRowComposer.displayName = "PreconRowComposer";
