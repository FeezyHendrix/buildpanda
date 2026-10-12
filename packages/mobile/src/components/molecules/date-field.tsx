import Ionicons from "@expo/vector-icons/Ionicons";
import DateTimePicker from "@expo/ui/community/datetime-picker";
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { FieldLabel, Text } from "@/components/atoms";
import { ICON_BRAND, ICON_MUTED, palette } from "@/constants/colors";
import { formatDate, isIsoDate, localIsoDate } from "@/lib/dates";

interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD`, or "" when no date is set. */
  value: string;
  onChange: (value: string) => void;
  /** Offers "Clear" and a "No date" placeholder. */
  optional?: boolean;
  placeholder?: string;
  minimumDate?: Date;
  error?: string;
}

const toDate = (value: string) => (isIsoDate(value) ? new Date(`${value}T12:00:00`) : new Date());

/**
 * A calendar instead of typing `YYYY-MM-DD`: an inline calendar under the
 * field on iOS, the system dialog on Android. Gloves and site light make
 * typing dates the slowest part of a form.
 */
export function DateField({ label, value, onChange, optional = false, placeholder, minimumDate, error }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const shown = isIsoDate(value) ? formatDate(value) : "";

  function pick(date: Date) {
    onChange(localIsoDate(date));
    setOpen(false);
  }

  return (
    <View className="gap-2">
      <FieldLabel>{label}</FieldLabel>
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown || "not set"}. Tap to pick a date.`}
          onPress={() => setOpen((current) => !current)}
          className={`min-h-14 flex-1 flex-row items-center gap-3 rounded-xl border bg-surface px-4 ${error ? "border-error-500" : open ? "border-primary-500" : "border-line"}`}
        >
          <Ionicons name="calendar-outline" size={20} color={ICON_BRAND} />
          <Text tone={shown ? "default" : "muted"} className="flex-1 text-sm">{shown || placeholder || (optional ? "No date" : "Pick a date")}</Text>
          <Ionicons name={open && Platform.OS === "ios" ? "chevron-up" : "chevron-down"} size={16} color={ICON_MUTED} />
        </Pressable>
        {optional && shown ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} onPress={() => { onChange(""); setOpen(false); }} className="min-h-14 justify-center rounded-xl px-3">
            <Text tone="brand" weight="semibold" className="text-sm">Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text tone="danger" className="text-xs">{error}</Text> : null}
      {open ? (
        Platform.OS === "android" ? (
          <DateTimePicker
            value={toDate(value)}
            mode="date"
            presentation="dialog"
            minimumDate={minimumDate}
            accentColor={palette.primary500}
            onValueChange={(_event, date) => pick(date)}
            onDismiss={() => setOpen(false)}
          />
        ) : (
          <View className="rounded-xl border border-line bg-surface p-2">
            <DateTimePicker
              value={toDate(value)}
              mode="date"
              display="inline"
              minimumDate={minimumDate}
              accentColor={palette.primary500}
              onValueChange={(_event, date) => pick(date)}
            />
          </View>
        )
      ) : null}
    </View>
  );
}
