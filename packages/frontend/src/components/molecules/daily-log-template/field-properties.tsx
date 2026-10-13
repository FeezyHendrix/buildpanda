import { Plus, X } from "lucide-react";
import { INPUT_CLASS, INPUT_SM_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Switcher } from "@/components/atoms/switcher";
import type { TemplateFieldType } from "@/api/daily-log-templates";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_META, FIELD_TYPE_ORDER, type DraftField } from "./field-types";

export const ICON_BUTTON = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 outline-none transition-colors",
  "hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-gray-900/10",
  "disabled:pointer-events-none disabled:opacity-30",
);

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Options</Label>
      {options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={option}
            placeholder={`Option ${index + 1}`}
            aria-label={`Option ${index + 1}`}
            onChange={(e) => onChange(options.map((o, i) => (i === index ? e.target.value : o)))}
            className={INPUT_SM_CLASS}
          />
          <button
            type="button"
            className={ICON_BUTTON}
            aria-label={`Remove option ${index + 1}`}
            disabled={options.length <= 1}
            onClick={() => onChange(options.filter((_, i) => i !== index))}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-primary-500 hover:underline"
        onClick={() => onChange([...options, ""])}
      >
        <Plus className="size-3.5" /> Add option
      </button>
    </div>
  );
}

/** Everything about one question: its kind, wording, choices and whether it must be answered. */
export function FieldProperties({ field, onChange }: { field: DraftField; onChange: (patch: Partial<DraftField>) => void }) {
  const isSection = field.type === "section";

  function changeType(type: TemplateFieldType): void {
    onChange({
      type,
      options: type === "select" && (field.options ?? []).length === 0 ? ["", ""] : field.options,
      required: type === "section" ? false : field.required,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`fp-type-${field.key}`}>Field type</Label>
        <select id={`fp-type-${field.key}`} value={field.type} onChange={(e) => changeType(e.target.value as TemplateFieldType)} className={INPUT_SM_CLASS}>
          {FIELD_TYPE_ORDER.map((type) => (
            <option key={type} value={type}>{FIELD_TYPE_META[type].label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`fp-label-${field.key}`}>{isSection ? "Section title" : "Question"}</Label>
        <input
          id={`fp-label-${field.key}`}
          value={field.label}
          autoFocus={!field.label}
          placeholder={isSection ? "e.g. Manpower" : "e.g. Workers on site"}
          maxLength={200}
          onChange={(e) => onChange({ label: e.target.value })}
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`fp-help-${field.key}`}>Help text (optional)</Label>
        <input
          id={`fp-help-${field.key}`}
          value={field.helpText ?? ""}
          placeholder="Shown under the question"
          onChange={(e) => onChange({ helpText: e.target.value || null })}
          className={INPUT_SM_CLASS}
        />
      </div>
      {field.type === "select" ? <OptionsEditor options={field.options ?? []} onChange={(options) => onChange({ options })} /> : null}
      {field.type === "number" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`fp-unit-${field.key}`}>Unit (optional)</Label>
          <input
            id={`fp-unit-${field.key}`}
            value={field.unit ?? ""}
            placeholder="e.g. workers, m³, hrs"
            onChange={(e) => onChange({ unit: e.target.value || null })}
            className={INPUT_SM_CLASS}
          />
        </div>
      ) : null}
      {!isSection ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Required</p>
            <p className="text-xs text-gray-400">The log can&apos;t be added until it&apos;s answered.</p>
          </div>
          <Switcher value={field.required ? "yes" : "no"} onChange={(next) => onChange({ required: next === "yes" })} />
        </div>
      ) : null}
    </div>
  );
}

FieldProperties.displayName = "FieldProperties";
