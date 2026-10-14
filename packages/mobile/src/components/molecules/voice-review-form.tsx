import { useState } from "react";
import { View } from "react-native";
import { isVoiceRichText } from "@buildpanda/voice-actions";
import type { MissingField } from "@/api/voice-report-types";
import { Button, Text } from "@/components/atoms";
import type { ReviewValue, ReviewValues } from "@/lib/voice-missing-fields";
import { VoiceMissingFields } from "./voice-missing-fields";

export function VoiceReviewForm({ fields, values, onChangeField }: {
  fields: readonly MissingField[]; values: ReviewValues;
  onChangeField: (name: string, value: ReviewValue) => void;
}) {
  const [showOptional, setShowOptional] = useState(false);
  const [optionalNames] = useState(() => new Set(fields.filter((field) => {
    const value = values[field.name];
    return field.required === false && (value === undefined || value === "" || (isVoiceRichText(value) && !value.text));
  }).map((field) => field.name)));
  const optional = fields.filter((field) => optionalNames.has(field.name));
  const visible = fields.filter((field) => !optionalNames.has(field.name));
  return <View className="gap-4">
    <Text tone="secondary" className="text-xs">Complete required details, or uncheck the action to skip it.</Text>
    <VoiceMissingFields fields={visible} values={values} onChangeField={onChangeField} />
    {optional.length ? <Button variant="ghost" onPress={() => setShowOptional(!showOptional)}>{showOptional ? "Hide optional details" : `Add optional details (${optional.length})`}</Button> : null}
    {showOptional ? <VoiceMissingFields fields={optional} values={values} onChangeField={onChangeField} /> : null}
  </View>;
}
