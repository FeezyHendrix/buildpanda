import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { isVoiceRichText, richTextFromHtml } from "@buildpanda/voice-actions";
import type { ReviewValue, ReviewValues } from "@/lib/voice-missing-fields";
import { View } from "react-native";
import type { MissingField } from "@/api/voice-report-types";
import { Button, Field, FieldLabel, OptionRow, Text } from "@/components/atoms";
import { reviewFieldError } from "@/lib/voice-missing-fields";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";

function label(field: MissingField) {
  return `${field.label} · ${field.required === false ? "Optional" : "Required"}`;
}
function maskIsoDate(next: string): string {
  const digits = next.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join("-");
}

function SelectField({ field, value, onChange }: { field: MissingField; value: string; onChange: (next: string) => void }) {
  const [search, setSearch] = useState("");
  const options = field.options ?? [];
  const visible = options.filter((option) => option.value === value || option.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <View className="gap-2">
    {options.length > 8 ? <Field label={`Find ${field.label.toLowerCase()}`} value={search} onChangeText={setSearch} placeholder="Search available choices" /> : null}
    <OptionRow label={label(field)} options={visible} value={value} onChange={onChange} />
    {options.length === 0 ? <Text tone="secondary" className="text-xs">No available choices. {field.required === false ? "You can leave this blank." : "Skip this action or refresh access and try again."}</Text> : null}
    {options.length > 0 && visible.length === 0 ? <Text tone="secondary">No matching choices. Try another name.</Text> : null}
    {field.required === false && value ? <Button variant="ghost" onPress={() => onChange("")}>Clear selection</Button> : null}
  </View>;
}

function TypedField({ field, value, onChange }: { field: MissingField; value: string; onChange: (next: string) => void }) {
  const error = value.trim() ? reviewFieldError(field, value) : undefined;
  return <Field
    label={label(field)} value={value}
    onChangeText={field.type === "date" ? (next) => onChange(maskIsoDate(next)) : onChange}
    keyboardType={field.type === "date" ? "number-pad" : field.type === "number" ? "numeric" : "default"}
    multiline={field.type === "long_text"}
    placeholder={field.type === "date" ? "YYYY-MM-DD" : field.type === "number" ? "0" : `Add the ${field.label.toLowerCase()}`}
    helperText={field.helpText ?? (field.type === "date" ? "Year, month, day" : undefined)} error={error}
  />;
}

/** Every supported type has an explicit control; unsupported contracts never become a text box. */
function ReviewField({ field, value, onChange }: { field: MissingField; value?: ReviewValue; onChange: (value: ReviewValue) => void }) {
  switch (field.type) {
    case "file": return <FileField field={field} value={value} onChange={onChange} />;
    case "boolean": return <View className="gap-2">
      <OptionRow label={label(field)} value={value === true ? "yes" : value === false ? "no" : ""}
        options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} onChange={(next) => onChange(next === "yes")} />
      {field.helpText ? <Text tone="secondary" className="text-xs">{field.helpText}</Text> : null}
    </View>;
    case "rich_text": return <View className="gap-2">
      <FieldLabel>{label(field)}</FieldLabel>
      <RichTextEditor label={label(field)} value={isVoiceRichText(value) ? value.html : ""} onChange={(html) => onChange(richTextFromHtml(html))}
        placeholder={`Add the ${field.label.toLowerCase()}`} />
      <Text tone="secondary" className="text-xs">{field.helpText ?? "Formatting is kept with this record."}</Text>
      {isVoiceRichText(value) && value.html && reviewFieldError(field, value) ? <Text tone="danger" className="text-xs">{reviewFieldError(field, value)}</Text> : null}
    </View>;
    case "select": return <SelectField field={field} value={typeof value === "string" ? value : ""} onChange={onChange} />;
    case "text": case "long_text": case "number": case "date":
      return <TypedField field={field} value={typeof value === "string" ? value : ""} onChange={onChange} />;
    default: {
      const unsupported: never = field.type;
      return <Text tone="danger">This app cannot review {String(unsupported)} fields yet. Update the app or skip this action.</Text>;
    }
  }
}

export function VoiceMissingFields({ fields, values, onChangeField }: {
  fields: readonly MissingField[]; values: ReviewValues | undefined;
  onChangeField: (fieldName: string, value: ReviewValue) => void;
}) {
  return <View className="gap-4">{fields.map((field) => <ReviewField key={field.name} field={field} value={values?.[field.name]}
    onChange={(value) => onChangeField(field.name, value)} />)}</View>;
}

function FileField({ field, value, onChange }: { field: MissingField; value?: ReviewValue; onChange: (value: ReviewValue) => void }) {
  const [error, setError] = useState<string | null>(null);
  const file = value && typeof value === "object" && "fileName" in value ? value : null;
  const pick = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      onChange({ uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType ?? "application/octet-stream", size: asset.size ?? 0 });
    } catch { setError("Could not open the file picker. Try again."); }
  };
  return <View className="gap-2">
    <FieldLabel>{label(field)}</FieldLabel>
    <Button variant="secondary" onPress={() => void pick()}>{file ? `Change ${file.fileName}` : field.label}</Button>
    {error ? <Text tone="danger">{error}</Text> : null}
  </View>;
}
