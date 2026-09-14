import { TextInput, View, type TextInputProps } from "react-native";
import { ICON_SUBTLE } from "@/constants/colors";
import { Text } from "./text";
import { cn } from "@/lib/utils";

/**
 * The one form label. `Field` and `OptionRow` use it, and so does anything a
 * TextInput cannot hold (a rich-text editor, a file picker) so a label reads
 * the same above every control on a form.
 */
export function FieldLabel({ children }: { children: string }) {
  return (
    <Text weight="semibold" className="text-[13px]">
      {children}
    </Text>
  );
}

FieldLabel.displayName = "FieldLabel";

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  className?: string;
}

export function Field({ label, error, helperText, className, ...props }: FieldProps) {
  return (
    <View className={cn("gap-2", className)}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        className={cn(
          "h-14 rounded-xl bg-surface-alt px-4 font-jakarta text-base text-black-500",
          error && "border border-error-500",
        )}
        placeholderTextColor={ICON_SUBTLE}
        {...props}
      />
      {error ? (
        <Text tone="danger" className="text-xs">
          {error}
        </Text>
      ) : helperText ? (
        <Text tone="muted" className="text-xs">
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

Field.displayName = "Field";

export type { FieldProps };
