import { useEffect, useState } from "react";
import { Label } from "@/components/atoms/label";
import { currencySymbol } from "@/lib/formatters";
import { FormDrawer } from "./form-drawer";

export interface SelectionOptionValues {
  name: string;
  description: string | null;
  price: number | null;
}

export interface UpsertSelectionValues {
  title: string;
  category: string | null;
  description: string | null;
  allowanceAmount: number | null;
  dueDate: string | null;
  options: SelectionOptionValues[];
}

interface OptionDraft {
  name: string;
  description: string;
  price: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  currency: string;
  initial?: Partial<UpsertSelectionValues>;
  onSubmit: (values: UpsertSelectionValues) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

const EMPTY_OPTION: OptionDraft = { name: "", description: "", price: "" };

const field =
  "h-11 rounded-lg bg-[#F6F6F6] px-3 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10";

function toDrafts(options: SelectionOptionValues[] | undefined): OptionDraft[] {
  if (!options || options.length === 0) return [{ ...EMPTY_OPTION }];
  return options.map((o) => ({
    name: o.name,
    description: o.description ?? "",
    price: o.price === null ? "" : String(o.price),
  }));
}

function parsePrice(value: string): number | null {
  const n = Number(value);
  return value.trim() === "" || Number.isNaN(n) ? null : n;
}

function UpsertSelectionDialog({
  open,
  onOpenChange,
  mode,
  currency,
  initial,
  onSubmit,
  isSubmitting = false,
  error,
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [allowance, setAllowance] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([{ ...EMPTY_OPTION }]);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setCategory(initial?.category ?? "");
      setDescription(initial?.description ?? "");
      setAllowance(
        initial?.allowanceAmount === undefined || initial?.allowanceAmount === null
          ? ""
          : String(initial.allowanceAmount),
      );
      setDueDate(initial?.dueDate ?? "");
      setOptions(toDrafts(initial?.options));
    }
  }, [open, initial]);

  function setOption(index: number, patch: Partial<OptionDraft>): void {
    setOptions((curr) => curr.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function removeOption(index: number): void {
    setOptions((curr) => curr.filter((_, i) => i !== index));
  }

  function handleSubmit(): void {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      category: category.trim() || null,
      description: description.trim() || null,
      allowanceAmount: parsePrice(allowance),
      dueDate: dueDate || null,
      options: options
        .filter((o) => o.name.trim())
        .map((o) => ({
          name: o.name.trim(),
          description: o.description.trim() || null,
          price: parsePrice(o.price),
        })),
    });
  }

  const symbol = currencySymbol(currency);

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New selection" : "Edit selection"}
      description="Ask the homeowner to choose a finish or fixture, with an allowance budget and a deadline."
      submitLabel={mode === "create" ? "Create" : "Save changes"}
      submitDisabled={!title.trim()}
      submitting={isSubmitting}
      error={error ?? null}
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sel-title">Title</Label>
        <input
          id="sel-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Master bathroom floor tile"
          className={field}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sel-category">Category</Label>
          <input
            id="sel-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Bathroom"
            className={field}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sel-due">Decide by</Label>
          <input
            id="sel-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sel-allowance">Allowance ({symbol})</Label>
        <input
          id="sel-allowance"
          type="number"
          min="0"
          step="0.01"
          value={allowance}
          onChange={(e) => setAllowance(e.target.value)}
          placeholder="Budgeted amount for this selection"
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sel-desc">Details</Label>
        <textarea
          id="sel-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What is being selected, and anything the homeowner should know"
          className="rounded-lg bg-[#F6F6F6] px-3 py-2.5 text-sm text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Options</Label>
        {options.map((option, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border border-[#EDEDED] p-3">
            <div className="flex items-center gap-2">
              <input
                value={option.name}
                onChange={(e) => setOption(index, { name: e.target.value })}
                placeholder={`Option ${index + 1} name`}
                aria-label={`Option ${index + 1} name`}
                className={`${field} min-w-0 flex-1`}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={option.price}
                onChange={(e) => setOption(index, { price: e.target.value })}
                placeholder={`Price (${symbol})`}
                aria-label={`Option ${index + 1} price`}
                className={`${field} w-32`}
              />
              <button
                type="button"
                onClick={() => removeOption(index)}
                disabled={options.length === 1}
                className="shrink-0 text-xs font-medium text-gray-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </div>
            <input
              value={option.description}
              onChange={(e) => setOption(index, { description: e.target.value })}
              placeholder="Optional description (supplier, model, colour…)"
              aria-label={`Option ${index + 1} description`}
              className={field}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setOptions((curr) => [...curr, { ...EMPTY_OPTION }])}
          className="self-start text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          + Add option
        </button>
      </div>
    </FormDrawer>
  );
}

UpsertSelectionDialog.displayName = "UpsertSelectionDialog";

export { UpsertSelectionDialog };
