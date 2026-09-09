import { Sparkles } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/atoms/badge";
import type { RiskEditState, SafetyDocStatus } from "@/api/precon-safety";
import { cn } from "@/lib/utils";

// One chip vocabulary for every AI-drafted safety artefact: where a row sits
// between Panda AI's draft and a person's sign-off.
const STATE_META: Record<RiskEditState | SafetyDocStatus, { label: string; tone: BadgeTone }> = {
  ai_draft: { label: "AI draft", tone: "info" },
  draft: { label: "AI draft", tone: "info" },
  edited: { label: "Edited", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
};

export function DraftStateChip({ state }: { state: RiskEditState | SafetyDocStatus }) {
  const meta = STATE_META[state];
  return (
    <Badge tone={meta.tone} dot={state === "ai_draft" || state === "draft"}>
      {meta.label}
    </Badge>
  );
}
DraftStateChip.displayName = "DraftStateChip";

// Compact controls for dense editable tables. Same tokens as the take-off
// review panels so the safety pack reads as the same product.
export const cellInputClass =
  "h-8 w-full rounded-lg border-0 bg-[#F6F6F6] px-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100 disabled:opacity-60";
export const cellTextareaClass =
  "min-h-16 w-full resize-y rounded-lg border-0 bg-[#F6F6F6] px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-primary-100";

export function EnumSelect<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  value: T | null;
  options: readonly T[];
  onChange: (next: T | null) => void;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className={cn(cellInputClass, "capitalize", className)}
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as T | null)}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option} value={option} className="capitalize">
          {option}
        </option>
      ))}
    </select>
  );
}
EnumSelect.displayName = "EnumSelect";

export function DraftButton({ label, loading, onClick }: { label: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 text-sm font-semibold text-primary-700",
        "outline-none transition-colors hover:bg-primary-100 focus-visible:ring-2 focus-visible:ring-primary-100 disabled:opacity-60",
      )}
    >
      <Sparkles className="size-4" aria-hidden="true" />
      {loading ? "Drafting…" : label}
    </button>
  );
}
DraftButton.displayName = "DraftButton";

// Editable string list (hazards, controls) used by statements and the phase plan.
export function StringListEditor({
  values,
  onChange,
  placeholder,
  addLabel,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  const update = (index: number, text: string) => onChange(values.map((v, i) => (i === index ? text : v)));
  const remove = (index: number) => onChange(values.filter((_, i) => i !== index));
  return (
    <div className="flex flex-col gap-1.5">
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            className={cellInputClass}
            value={value}
            placeholder={placeholder}
            onChange={(e) => update(index, e.target.value)}
          />
          <button type="button" className="text-xs text-gray-400 hover:text-red-600" onClick={() => remove(index)} aria-label="Remove">
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="w-fit text-xs font-semibold text-primary-700 hover:underline" onClick={() => onChange([...values, ""])}>
        + {addLabel}
      </button>
    </div>
  );
}
StringListEditor.displayName = "StringListEditor";
