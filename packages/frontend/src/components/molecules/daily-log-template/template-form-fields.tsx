import { INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Switcher } from "@/components/atoms/switcher";
import type {
  TemplateAnswer,
  TemplateField,
  TemplateResponses,
} from "@/api/daily-log-templates";
import { cn } from "@/lib/utils";

/** The required questions still unanswered. Mirrors the server's check. */
export function missingRequired(fields: TemplateField[], responses: TemplateResponses): string[] {
  return fields.flatMap((field) => {
    if (field.type === "section" || !field.required) return [];
    const value = responses[field.id];
    const blank = value === undefined || value === null || (typeof value === "string" && value.trim() === "");
    return blank ? [field.label] : [];
  });
}

interface FieldInputProps {
  field: TemplateField;
  value: TemplateAnswer | undefined;
  onChange: (value: TemplateAnswer) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const id = `tf-${field.id}`;
  const text = typeof value === "string" ? value : "";
  switch (field.type) {
    case "long_text":
      return (
        <textarea
          id={id}
          rows={3}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className={cn(INPUT_CLASS, "h-auto min-h-20 py-3")}
        />
      );
    case "number":
      return (
        <div className="flex items-center gap-3">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            className={cn(INPUT_CLASS, "max-w-40")}
          />
          {field.unit ? <span className="text-sm text-ink-muted">{field.unit}</span> : null}
        </div>
      );
    case "select":
      return (
        <select id={id} value={text} onChange={(e) => onChange(e.target.value || null)} className={INPUT_CLASS}>
          <option value="">Choose…</option>
          {field.options.filter(Boolean).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "yes_no":
      return (
        <Switcher
          value={value === true ? "yes" : value === false ? "no" : null}
          onChange={(next) => onChange(next === "yes")}
          className="w-fit"
        />
      );
    default:
      return <input id={id} value={text} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />;
  }
}

function TemplateFieldRow({ field, value, onChange }: FieldInputProps) {
  if (field.type === "section") {
    return (
      <div className="border-b border-line-hair pb-2 pt-2 first:pt-0">
        <h4 className="text-xs font-medium uppercase text-ink-muted">{field.label || "Untitled section"}</h4>
        {field.helpText ? <p className="mt-0.5 text-xs text-gray-400">{field.helpText}</p> : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`tf-${field.id}`}>
        {field.label || "Untitled question"}
        {field.required ? <span className="ml-0.5 text-error-500">*</span> : null}
      </Label>
      <FieldInput field={field} value={value} onChange={onChange} />
      {field.helpText ? <p className="text-xs text-gray-400">{field.helpText}</p> : null}
    </div>
  );
}

interface TemplateFormFieldsProps {
  fields: TemplateField[];
  responses: TemplateResponses;
  onChange: (fieldId: string, value: TemplateAnswer) => void;
  className?: string;
}

/** Renders a daily log template as a fillable form. Used to fill an entry and to preview the builder. */
export function TemplateFormFields({ fields, responses, onChange, className }: TemplateFormFieldsProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {fields.map((field) => (
        <TemplateFieldRow
          key={field.id}
          field={field}
          value={responses[field.id]}
          onChange={(value) => onChange(field.id, value)}
        />
      ))}
    </div>
  );
}

TemplateFormFields.displayName = "TemplateFormFields";
