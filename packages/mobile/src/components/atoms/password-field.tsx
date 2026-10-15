import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable } from "react-native";
import { ICON_SUBTLE } from "@/constants/colors";
import { Field, type FieldProps } from "./input";

type PasswordFieldProps = Omit<FieldProps, "secureTextEntry" | "multiline" | "endAdornment">;

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return <Field autoCapitalize="none" autoCorrect={false} {...props} secureTextEntry={!visible}
    endAdornment={<Pressable accessibilityRole="button"
      accessibilityLabel={visible ? "Hide password" : "Show password"}
      accessibilityState={{ checked: visible }}
      onPress={() => setVisible((value) => !value)}
      className="h-14 w-14 items-center justify-center rounded-xl active:bg-grey-50">
      <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={22} color={ICON_SUBTLE} />
    </Pressable>} />;
}
