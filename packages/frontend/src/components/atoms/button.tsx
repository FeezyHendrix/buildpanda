import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner, type SpinnerTone } from "@/components/atoms/spinner";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "danger-outline" | "light-danger" | "light-danger-outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const spinnerTone: Record<ButtonVariant, SpinnerTone> = {
  primary: "current",
  secondary: "brand",
  ghost: "brand",
  outline: "brand",
  danger: "current",
  "danger-outline": "current",
  "light-danger": "current",
  "light-danger-outline": "current",
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:         "bg-[#004DE7] !text-white hover:bg-[#053DAB] active:bg-[#002061]",
  secondary:       "bg-[#F5F5F5] text-[#1E1E1E] hover:bg-[#EBEBEB] active:bg-[#D6D6D6]",
  ghost:           "bg-transparent text-[#1E1E1E] hover:bg-[#F5F5F5] active:bg-[#EBEBEB]",
  outline:         "border-[0.5px] border-border bg-white text-[#1E1E1E] hover:bg-[#F5F5F5] active:bg-[#EBEBEB]",
  danger:          "bg-[#E7000B] !text-white hover:bg-[#A30006] active:bg-[#850005]",
  "danger-outline":       "border border-[#FFC9C9] bg-[#FEF2F2] !text-[#E7000B] hover:bg-[#FEF2F2] active:bg-[#FEE2E2]",
  "light-danger":         "bg-[#FEF2F2] text-[#C10007] hover:bg-[#FEE2E2] active:bg-[#FECACA]",
  "light-danger-outline": "border border-[#FFC9C9] bg-white text-[#C10007] hover:bg-[#FEE2E2] active:bg-[#FECACA]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-caption-s",
  md: "h-9 px-4 text-caption-l",
  lg: "h-12 px-5 text-caption-l",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex items-center justify-center gap-2.5 rounded-none font-semibold",
        "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-grey-50 disabled:!text-black-500",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner size="xs" tone={spinnerTone[variant]} />}
      {children}
    </button>
  ),
);

Button.displayName = "Button";

export { Button, type ButtonProps };
