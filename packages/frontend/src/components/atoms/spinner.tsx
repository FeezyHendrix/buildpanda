import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

const sizeClass: Record<SpinnerSize, string> = {
  sm: "size-6",
  md: "size-7",
  lg: "size-8",
};

function Spinner({ size = "md", className, label = "Loading" }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        "animate-spin rounded-full border-2 border-gray-200 border-t-[#004DE7]",
        sizeClass[size],
        className,
      )}
    />
  );
}

Spinner.displayName = "Spinner";

export { Spinner, type SpinnerProps };
