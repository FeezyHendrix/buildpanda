import Ionicons from "@expo/vector-icons/Ionicons";
import { memo } from "react";
import { Pressable } from "react-native";
import { Spinner } from "@/components/atoms";
import { ICON_DEFAULT } from "@/constants/colors";
import type { AccessRequirement } from "@/lib/access-requirement";
import { useProjectAccess } from "@/lib/project-access-provider";

interface HeaderIconButtonProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  /** Shows the spinner in the icon's place and blocks a second press. */
  busy?: boolean;
  disabled?: boolean;
  permission?: AccessRequirement;
}

/** The only way to put an action in the page header — keeps size and colour uniform. */
export const HeaderIconButton = memo(function HeaderIconButton({
  icon,
  label,
  onPress,
  busy = false,
  disabled = false,
  permission,
}: HeaderIconButtonProps) {
  const { allows } = useProjectAccess();
  if (permission && !allows(permission)) return null;
  const blocked = busy || disabled;
  return (
    <Pressable
      onPress={() => { if (!permission || allows(permission)) onPress(); }}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy }}
      className="h-11 w-11 items-center justify-center rounded-full active:bg-surface-alt"
      style={blocked && !busy ? { opacity: 0.5 } : undefined}
    >
      {busy ? <Spinner size="xs" tone="brand" /> : <Ionicons name={icon} size={24} color={ICON_DEFAULT} />}
    </Pressable>
  );
});
