import Ionicons from "@/components/atoms/icon";
import { useState } from "react";
import { ICON_SUBTLE } from "@/constants/colors";
import { Field, type FieldProps } from "./input";
type PasswordFieldProps = Omit<FieldProps, "secureTextEntry" | "multiline" | "endAdornment">;
export function PasswordField(props: PasswordFieldProps) {
    const [visible, setVisible] = useState(false);
    return <Field autoCapitalize="none" autoCorrect={false} {...props} secureTextEntry={!visible} endAdornment={<button role="button" aria-label={visible ? "Hide password" : "Show password"} aria-checked={visible} onClick={() => setVisible((value) => !value)} className="h-14 w-14 items-center justify-center rounded-xl active:bg-grey-50" type="button">
      <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={22} color={ICON_SUBTLE}/>
    </button>}/>;
}
