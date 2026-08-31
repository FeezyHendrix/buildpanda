import { ActivityIndicator } from "react-native";

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
  brand: "#004DE7",
  current: "#FFFFFF",
};

export function Spinner({ size = "md", tone = "brand" }: SpinnerProps) {
  return <ActivityIndicator size={nativeSize[size]} color={toneColor[tone]} />;
}

Spinner.displayName = "Spinner";

export type { SpinnerProps, SpinnerSize, SpinnerTone };
