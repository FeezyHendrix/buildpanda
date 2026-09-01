import { Pressable, View } from "react-native";
import type { MissingField } from "@/api/voice-report-types";
import { Field, Text } from "@/components/atoms";
import { isFieldComplete } from "@/lib/voice-missing-fields";
import { cn } from "@/lib/utils";

/**
 * Keeps a typed date on the `YYYY-MM-DD` shape the API stores without pulling in
 * a picker: digits only, dashes inserted as you go. Backspacing still works
 * because the separators are re-derived from the digits on every keystroke.
 */
function maskIsoDate(next: string): string {
  const digits = next.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)]
    .filter((part) => part.length > 0)
    .join("-");
}

function SelectField({
  field,
  value,
  onChange,
}: {
  field: MissingField;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View className="gap-2">
      <Text weight="semibold" className="text-[13px]">
        {field.label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {(field.options ?? []).map((option) => {
          const isActive = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              className={cn(
                "min-h-11 justify-center rounded-xl px-4",
                isActive ? "bg-primary-500" : "bg-surface-alt",
              )}
            >
              <Text weight="semibold" tone={isActive ? "inverse" : "secondary"} className="text-[13px]">
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TypedField({
  field,
  value,
  onChange,
}: {
  field: MissingField;
  value: string;
  onChange: (next: string) => void;
}) {
  // Only nag once something has been typed — an untouched field is already
  // flagged by the card's "Needs N details" badge.
  const touched = value.trim().length > 0;
  const invalid = touched && !isFieldComplete(field, value);

  if (field.type === "date") {
    return (
      <Field
        label={field.label}
        value={value}
        onChangeText={(next) => onChange(maskIsoDate(next))}
        keyboardType="number-pad"
        placeholder="YYYY-MM-DD"
        helperText="Year, month, day"
        error={invalid ? "Use YYYY-MM-DD" : undefined}
      />
    );
  }

  if (field.type === "number") {
    return (
      <Field
        label={field.label}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        placeholder="0"
        error={invalid ? "Numbers only" : undefined}
      />
    );
  }

  return (
    <Field
      label={field.label}
      value={value}
      onChangeText={onChange}
      placeholder={`Add the ${field.label.toLowerCase()}`}
    />
  );
}

/**
 * The details Panda AI could not hear on one drafted action. Controlled and
 * stateless — the review screen owns the answers so they survive a toggle.
 */
export function VoiceMissingFields({
  fields,
  values,
  onChangeField,
}: {
  fields: readonly MissingField[];
  values: Record<string, string> | undefined;
  onChangeField: (fieldName: string, value: string) => void;
}) {
  return (
    <View className="gap-4">
      {fields.map((field) => {
        const value = values?.[field.name] ?? "";
        const change = (next: string) => onChangeField(field.name, next);
        return field.type === "select" ? (
          <SelectField key={field.name} field={field} value={value} onChange={change} />
        ) : (
          <TypedField key={field.name} field={field} value={value} onChange={change} />
        );
      })}
    </View>
  );
}

VoiceMissingFields.displayName = "VoiceMissingFields";
