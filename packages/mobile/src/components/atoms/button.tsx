import { useSyncExternalStore } from "react";
import { contentWork } from "@buildpanda/rich-content/pending";
import { Pressable, View, type PressableProps } from "react-native";
import { Spinner, type SpinnerTone } from "./spinner";
import { Text, type TextTone } from "./text";
import { cn } from "@/lib/utils";
import type { AccessRequirement } from "@/lib/access-requirement";
import { useProjectAccess } from "@/lib/project-access-provider";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  className?: string;
  permission?: AccessRequirement;
}

const spinnerTone: Record<ButtonVariant, SpinnerTone> = {
  primary: "current",
  secondary: "brand",
  ghost: "brand",
  danger: "brand",
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary-500 active:bg-primary-600",
  secondary: "border border-line bg-surface active:bg-surface-alt",
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
  md: "min-h-14 px-5 py-3",
  lg: "min-h-16 px-6 py-4",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  permission,
  ...props
}: ButtonProps) {
  const { allows } = useProjectAccess();
  const addingImage = useSyncExternalStore(contentWork.subscribe, contentWork.getSnapshot, contentWork.getSnapshot);
  if (permission && !allows(permission)) return null;
  const isDisabled = disabled === true || loading || addingImage;

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
      onPress={(event) => { if (!isDisabled && (!permission || allows(permission))) props.onPress?.(event); }}
    >
      {loading ? (
        <Spinner size="sm" tone={spinnerTone[variant]} />
      ) : (
        <Text weight="semibold" tone={labelTone[variant]} className="shrink text-center text-base">
          {children}
        </Text>
      )}
      <View className="w-0" />
    </Pressable>
  );
}

Button.displayName = "Button";

export type { ButtonProps, ButtonVariant, ButtonSize };
