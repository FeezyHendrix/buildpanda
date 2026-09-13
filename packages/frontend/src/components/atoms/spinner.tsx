import { cn } from "@/lib/utils";

type SpinnerSize = "xs" | "sm" | "md" | "lg";
type SpinnerTone = "brand" | "current";

interface SpinnerProps {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  className?: string;
  label?: string;
}

const sizeClass: Record<SpinnerSize, string> = {
  xs: "size-4 border-2",
  sm: "size-6 border-2",
  md: "size-7 border-2",
  lg: "size-8 border-2",
};

const toneClass: Record<SpinnerTone, string> = {
  brand: "border-gray-200 border-t-[#004DE7]",
  current: "border-current/30 border-t-current",
};

function Spinner({
  size = "md",
  tone = "brand",
  className,
  label = "Loading",
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "animate-spin rounded-full",
        sizeClass[size],
        toneClass[tone],
        className,
      )}
    />
  );
}

Spinner.displayName = "Spinner";

export { Spinner, type SpinnerProps, type SpinnerSize, type SpinnerTone };
