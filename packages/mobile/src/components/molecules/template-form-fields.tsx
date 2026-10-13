import { View } from "react-native";
import type { TemplateAnswer, TemplateField, TemplateResponses } from "@/api/daily-log-templates";
import { Field, OptionRow, Text } from "@/components/atoms";

function labelFor(field: TemplateField): string {
  const unit = field.type === "number" && field.unit ? ` (${field.unit})` : "";
  return `${field.label}${unit}${field.required ? " *" : ""}`;
}

/** Numbers are typed as text and parsed on save, so "12." or "1,5" survive mid-typing. */
function textOf(value: TemplateAnswer | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function FieldInput({ field, value, onChange }: {
  field: TemplateField;
  value: TemplateAnswer | undefined;
  onChange: (value: TemplateAnswer) => void;
}) {
  const helperText = field.helpText ?? undefined;
  switch (field.type) {
    case "section":
      return (
        <View className="gap-1 border-b border-hairline pb-2 pt-3">
          <Text weight="bold" className="text-base">{field.label}</Text>
          {field.helpText ? <Text tone="secondary" className="text-[13px]">{field.helpText}</Text> : null}
        </View>
      );
    case "yes_no":
      return (
        <OptionRow
          label={labelFor(field)}
          options={["Yes", "No"]}
          value={value === true ? "Yes" : value === false ? "No" : ""}
          // tapping the chosen answer again clears it
          onChange={(next) => onChange((next === "Yes") === value ? null : next === "Yes")}
        />
      );
    case "select":
      return (
        <OptionRow
          label={labelFor(field)}
          options={field.options}
          value={typeof value === "string" ? value : ""}
          onChange={(next) => onChange(next === value ? null : next)}
        />
      );
    case "number":
      return (
        <Field
          label={labelFor(field)}
          helperText={helperText}
          value={textOf(value)}
          onChangeText={onChange}
          keyboardType="decimal-pad"
        />
      );
    case "long_text":
      return (
        <Field label={labelFor(field)} helperText={helperText} value={textOf(value)} onChangeText={onChange} multiline />
      );
    default:
      return <Field label={labelFor(field)} helperText={helperText} value={textOf(value)} onChangeText={onChange} />;
  }
}

/** An admin's daily log form, filled on site. Required questions carry a *. */
export function TemplateFormFields({ fields, responses, onChange }: {
  fields: readonly TemplateField[];
  responses: TemplateResponses;
  onChange: (fieldId: string, value: TemplateAnswer) => void;
}) {
  return (
    <View className="gap-5">
      {fields.map((field) => (
        <FieldInput key={field.id} field={field} value={responses[field.id]} onChange={(value) => onChange(field.id, value)} />
      ))}
    </View>
  );
}

TemplateFormFields.displayName = "TemplateFormFields";
