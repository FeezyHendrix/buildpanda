import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cn } from "@/lib/utils";

type TextWeight = "regular" | "medium" | "semibold" | "bold" | "extrabold";
type TextTone = "default" | "secondary" | "muted" | "brand" | "danger" | "inverse";

interface TextProps extends RNTextProps {
  weight?: TextWeight;
  tone?: TextTone;
  variant?: "body" | "heading";
  className?: string;
}

const weightFamily: Record<TextWeight, string> = {
  regular: "font-inter",
  medium: "font-inter-medium",
  semibold: "font-inter-semibold",
  bold: "font-inter-bold",
  extrabold: "font-inter-extrabold",
};

const toneColor: Record<TextTone, string> = {
  default: "text-ink",
  secondary: "text-ink-muted",
  muted: "text-ink-muted",
  brand: "text-primary-500",
  danger: "text-error-600",
  inverse: "text-white",
};

export function Text({
  weight = "regular",
  tone = "default",
  variant = "body",
  className,
  ...props
}: TextProps) {
  return (
    <RNText
      accessibilityRole={variant === "heading" ? "header" : undefined}
      className={cn(
        variant === "heading"
          ? weight === "bold" || weight === "extrabold" ? "font-heading-bold" : "font-heading-semibold"
          : weightFamily[weight],
        toneColor[tone], className,
      )}
      {...props}
    />
  );
}

Text.displayName = "Text";

export type { TextProps, TextWeight, TextTone };
