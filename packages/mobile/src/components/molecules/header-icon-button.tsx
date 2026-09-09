import Ionicons from "@expo/vector-icons/Ionicons";
import { memo } from "react";
import { Pressable } from "react-native";
import { Spinner } from "@/components/atoms";

interface HeaderIconButtonProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  /** Shows the spinner in the icon's place and blocks a second press. */
  busy?: boolean;
  disabled?: boolean;
}

/** The only way to put an action in the blue header — keeps size and colour uniform. */
export const HeaderIconButton = memo(function HeaderIconButton({
  icon,
  label,
  onPress,
  busy = false,
  disabled = false,
}: HeaderIconButtonProps) {
  const blocked = busy || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy }}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-white/20"
      style={blocked && !busy ? { opacity: 0.5 } : undefined}
    >
      {busy ? <Spinner size="xs" tone="current" /> : <Ionicons name={icon} size={24} color="#FFFFFF" />}
    </Pressable>
  );
});
