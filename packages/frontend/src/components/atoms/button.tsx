import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner, type SpinnerTone } from "@/components/atoms/spinner";

type ButtonVariant = "primary" | "secondary" | "ghost";
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
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-[#004DE7] text-white hover:bg-[#0041c4] active:bg-[#003aad]",
  secondary: "bg-[#F6F6F6] text-gray-900 hover:bg-gray-200 active:bg-gray-300",
  ghost: "bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-14 px-5 py-3 text-md",
  lg: "h-16 px-6 py-3.5 text-base",
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
        "relative inline-flex items-center justify-center gap-2.5 rounded-lg font-semibold",
        "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Spinner size="xs" tone={spinnerTone[variant]} />
        </span>
      )}
      <span className={cn("inline-flex items-center gap-2.5", loading && "invisible")}>
        {children}
      </span>
    </button>
  ),
);

Button.displayName = "Button";

export { Button, type ButtonProps };
