import { useId, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/atoms";
import { Label } from "@/components/atoms";

interface FormFieldProps extends InputProps {
  /** Text shown above the input */
  label: string;
  /** Error message — replaces helper text when present */
  error?: string;
  /** Subtle guidance below the input */
  helperText?: string;
  /** Extra classes on the outer wrapper */
  wrapperClassName?: string;
  /** Props forwarded to the Label element */
  labelProps?: Omit<ComponentPropsWithoutRef<typeof Label>, "htmlFor" | "children">;
}

function FormField({
  label,
  error,
  helperText,
  wrapperClassName,
  labelProps,
  id: externalId,
  ...inputProps
}: FormFieldProps) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const messageId = `${id}-message`;
  const hasMessage = !!error || !!helperText;

  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      <Label htmlFor={id} {...labelProps}>
        {label}
      </Label>

      <Input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={hasMessage ? messageId : undefined}
        {...inputProps}
      />

      {hasMessage && (
        <p
          id={messageId}
          className={cn(
            "text-xs text-pretty",
            error ? "text-red-500" : "text-gray-400",
          )}
        >
          {error ?? helperText}
        </p>
      )}
    </div>
  );
}

FormField.displayName = "FormField";

export { FormField, type FormFieldProps };
