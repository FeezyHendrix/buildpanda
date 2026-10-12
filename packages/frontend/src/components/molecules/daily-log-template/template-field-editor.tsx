import { ArrowDown, ArrowUp, Copy, Plus, Trash2, X } from "lucide-react";
import { INPUT_CLASS, INPUT_SM_CLASS } from "@/components/atoms/input";
import { Switcher } from "@/components/atoms/switcher";
import type { TemplateFieldType } from "@/api/daily-log-templates";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_META, FIELD_TYPE_ORDER, type DraftField } from "./field-types";

const ICON_BUTTON = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 outline-none transition-colors",
  "hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-gray-900/10",
  "disabled:pointer-events-none disabled:opacity-30",
);

export interface FieldEditorActions {
  onChange: (patch: Partial<DraftField>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-ink-muted">Options</span>
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

interface TemplateFieldEditorProps {
  field: DraftField;
  index: number;
  count: number;
  actions: FieldEditorActions;
}

/** One question (or section heading) in the template builder. */
export function TemplateFieldEditor({ field, index, count, actions }: TemplateFieldEditorProps) {
  const isSection = field.type === "section";
  const Icon = FIELD_TYPE_META[field.type].icon;

  function changeType(type: TemplateFieldType): void {
    actions.onChange({
      type,
      options: type === "select" && (field.options ?? []).length === 0 ? ["", ""] : field.options,
      required: type === "section" ? false : field.required,
    });
  }

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border border-line p-4", isSection ? "bg-surface-alt" : "bg-white")}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-ink-muted" aria-hidden />
        <select
          aria-label="Field type"
          value={field.type}
          onChange={(e) => changeType(e.target.value as TemplateFieldType)}
          className={cn(INPUT_SM_CLASS, "w-44", isSection && "bg-white")}
        >
          {FIELD_TYPE_ORDER.map((type) => (
            <option key={type} value={type}>
              {FIELD_TYPE_META[type].label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center">
          <button type="button" className={ICON_BUTTON} aria-label="Move up" disabled={index === 0} onClick={() => actions.onMove(-1)}>
            <ArrowUp className="size-4" />
          </button>
          <button type="button" className={ICON_BUTTON} aria-label="Move down" disabled={index === count - 1} onClick={() => actions.onMove(1)}>
            <ArrowDown className="size-4" />
          </button>
          <button type="button" className={ICON_BUTTON} aria-label="Duplicate field" onClick={actions.onDuplicate}>
            <Copy className="size-4" />
          </button>
          <button type="button" className={cn(ICON_BUTTON, "hover:bg-red-50 hover:text-red-600")} aria-label="Delete field" onClick={actions.onRemove}>
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <input
        value={field.label}
        placeholder={isSection ? "Section title, e.g. Manpower" : "Question, e.g. Workers on site"}
        aria-label={isSection ? "Section title" : "Question"}
        onChange={(e) => actions.onChange({ label: e.target.value })}
        className={cn(INPUT_CLASS, isSection && "bg-white")}
      />
      <input
        value={field.helpText ?? ""}
        placeholder="Help text (optional)"
        aria-label="Help text"
        onChange={(e) => actions.onChange({ helpText: e.target.value || null })}
        className={cn(INPUT_SM_CLASS, isSection && "bg-white")}
      />

      {field.type === "select" ? (
        <OptionsEditor options={field.options ?? []} onChange={(options) => actions.onChange({ options })} />
      ) : null}

      {field.type === "number" ? (
        <input
          value={field.unit ?? ""}
          placeholder="Unit, e.g. workers, m³, hrs"
          aria-label="Unit"
          onChange={(e) => actions.onChange({ unit: e.target.value || null })}
          className={cn(INPUT_SM_CLASS, "max-w-56")}
        />
      ) : null}

      {!isSection ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-700">Required</span>
          <Switcher
            value={field.required ? "yes" : "no"}
            onChange={(next) => actions.onChange({ required: next === "yes" })}
          />
        </div>
      ) : null}
    </div>
  );
}

TemplateFieldEditor.displayName = "TemplateFieldEditor";
