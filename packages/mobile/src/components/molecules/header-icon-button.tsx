import Ionicons from "@expo/vector-icons/Ionicons";
import { memo } from "react";
import { Pressable } from "react-native";

interface HeaderIconButtonProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}

/** The only way to put an action in the blue header — keeps size and colour uniform. */
export const HeaderIconButton = memo(function HeaderIconButton({
  icon,
  label,
  onPress,
}: HeaderIconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-white/20"
    >
      <Ionicons name={icon} size={24} color="#FFFFFF" />
    </Pressable>
  );
});
