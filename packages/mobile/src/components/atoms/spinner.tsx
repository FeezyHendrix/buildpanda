import { ActivityIndicator } from "react-native";
import { ICON_BRAND, ICON_INVERSE } from "@/constants/colors";

type SpinnerSize = "xs" | "sm" | "md" | "lg";
type SpinnerTone = "brand" | "current";

interface SpinnerProps {
  size?: SpinnerSize;
  tone?: SpinnerTone;
}

const nativeSize: Record<SpinnerSize, "small" | "large"> = {
  xs: "small",
  sm: "small",
  md: "small",
  lg: "large",
};

const toneColor: Record<SpinnerTone, string> = {
  brand: ICON_BRAND,
  current: ICON_INVERSE,
};

export function Spinner({ size = "md", tone = "brand" }: SpinnerProps) {
  return <ActivityIndicator size={nativeSize[size]} color={toneColor[tone]} />;
}

Spinner.displayName = "Spinner";

export type { SpinnerProps, SpinnerSize, SpinnerTone };
