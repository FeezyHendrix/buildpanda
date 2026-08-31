import { Pressable, View, type PressableProps } from "react-native";
import { Spinner, type SpinnerTone } from "./spinner";
import { Text, type TextTone } from "./text";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
}

const spinnerTone: Record<ButtonVariant, SpinnerTone> = {
  primary: "current",
  secondary: "brand",
  ghost: "brand",
  danger: "brand",
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary-500 active:bg-primary-600",
  secondary: "bg-grey-50 active:bg-grey-100",
  ghost: "bg-transparent active:bg-grey-50",
  danger: "bg-white border border-grey-50 active:bg-error-50",
};

const labelTone: Record<ButtonVariant, TextTone> = {
  primary: "inverse",
  secondary: "default",
  ghost: "secondary",
  danger: "danger",
};

// 56px is the floor for a gloved hand on site, so there is no `sm`.
const sizeStyles: Record<ButtonSize, string> = {
  md: "h-14 px-5",
  lg: "h-16 px-6",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled === true || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        "flex-row items-center justify-center rounded-xl",
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner size="sm" tone={spinnerTone[variant]} />
      ) : (
        <Text weight="semibold" tone={labelTone[variant]} className="text-base">
          {children}
        </Text>
      )}
      <View className="w-0" />
    </Pressable>
  );
}

Button.displayName = "Button";

export type { ButtonProps, ButtonVariant, ButtonSize };
