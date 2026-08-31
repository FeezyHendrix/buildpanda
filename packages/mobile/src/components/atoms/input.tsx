import { TextInput, View, type TextInputProps } from "react-native";
import { Text } from "./text";
import { cn } from "@/lib/utils";

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  className?: string;
}

export function Field({ label, error, helperText, className, ...props }: FieldProps) {
  return (
    <View className={cn("gap-2", className)}>
      <Text weight="semibold" className="text-[13px]">
        {label}
      </Text>
      <TextInput
        className={cn(
          "h-14 rounded-xl bg-surface-alt px-4 font-jakarta text-base text-black-500",
          error && "border border-error-500",
        )}
        placeholderTextColor="#ADADAD"
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
