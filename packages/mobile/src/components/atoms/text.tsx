import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cn } from "@/lib/utils";

type TextWeight = "regular" | "medium" | "semibold" | "bold" | "extrabold";
type TextTone = "default" | "secondary" | "muted" | "brand" | "danger" | "inverse";

interface TextProps extends RNTextProps {
  weight?: TextWeight;
  tone?: TextTone;
  className?: string;
}

const weightFamily: Record<TextWeight, string> = {
  regular: "font-jakarta",
  medium: "font-jakarta-medium",
  semibold: "font-jakarta-semibold",
  bold: "font-jakarta-bold",
  extrabold: "font-jakarta-extrabold",
};

const toneColor: Record<TextTone, string> = {
  default: "text-black-500",
  secondary: "text-grey-400",
  muted: "text-grey-300",
  brand: "text-primary-500",
  danger: "text-error-600",
  inverse: "text-white",
};

export function Text({
  weight = "regular",
  tone = "default",
  className,
  ...props
}: TextProps) {
  return (
    <RNText className={cn(weightFamily[weight], toneColor[tone], className)} {...props} />
  );
}

Text.displayName = "Text";

export type { TextProps, TextWeight, TextTone };
