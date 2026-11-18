import { ImageTextInput } from "@/components/rich-text/image-text-input";
import type { ReactNode, Ref } from "react";
import { TextInput, type TextInputProps } from "@/platform/browser";
import { ICON_SUBTLE } from "@/constants/colors";
import { Text } from "./text";
import { cn } from "@/lib/utils";
import { useKeyboardReveal } from "@/hooks/use-keyboard-avoidance";
/**
 * The one form label. `Field` and `OptionRow` use it, and so does anything a
 * TextInput cannot hold (a rich-text editor, a file picker) so a label reads
 * the same above every control on a form.
 */
export function FieldLabel({ children }: {
    children: string;
}) {
    return (<Text weight="semibold" className="text-[13px]">
      {children}
    </Text>);
}
FieldLabel.displayName = "FieldLabel";
interface FieldProps extends TextInputProps {
    ref?: Ref<TextInput>;
    label: string;
    error?: string;
    helperText?: string;
    images?: boolean;
    endAdornment?: ReactNode;
    className?: string;
}
export function Field({ label, error, helperText, className, onFocus, images = true, endAdornment, ...props }: FieldProps) {
    const reveal = useKeyboardReveal();
    const Input = props.multiline && images ? ImageTextInput : TextInput;
    return (<div className={"field-stack " + (cn("gap-2", className))}>
      <FieldLabel>{label}</FieldLabel>
      <div className="field-stack relative">
      <Input className={cn("min-h-14 rounded-xl bg-surface-alt px-4 py-3 font-inter text-base text-black-500", props.multiline && "min-h-28", error && "border border-error-500", endAdornment && "pr-14")} aria-label={label} textAlignVertical={props.multiline ? "top" : "center"} placeholderTextColor={ICON_SUBTLE} {...props} onFocus={(event) => {
            reveal?.();
            onFocus?.(event);
        }}/>
      {endAdornment ? <div className="field-stack absolute bottom-0 right-0 top-0 justify-center">{endAdornment}</div> : null}
      </div>
      {error ? (<Text tone="danger" className="text-xs">
          {error}
        </Text>) : helperText ? (<Text tone="muted" className="text-xs">
          {helperText}
        </Text>) : null}
    </div>);
}
Field.displayName = "Field";
export type { FieldProps };
