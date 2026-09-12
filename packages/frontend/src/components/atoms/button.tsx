import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner, type SpinnerTone } from "@/components/atoms/spinner";

/**
 * primary   — filled brand blue (the one call to action on a surface)
 * secondary — white, hairline border; hover tints to the brand
 * ghost     — text-only; hover wash
 * danger    — text-only in the negative colour (destructive rows/footers)
 */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
/** sm 32px (inline), md 38px (toolbars, the default), lg 46px (forms, drawer footers). */
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
  danger: "current",
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 disabled:border disabled:border-line-disabled disabled:bg-surface-alt disabled:text-ink-disabled",
  secondary:
    "border border-line bg-white text-ink hover:border-primary-500 hover:bg-primary-50 hover:text-primary-600 active:bg-primary-100 disabled:border-line-disabled disabled:bg-surface-alt disabled:text-ink-disabled",
  ghost:
    "bg-transparent text-primary-500 hover:bg-black/5 active:bg-black/10 disabled:text-ink-disabled",
  danger:
    "bg-transparent text-negative-500 hover:bg-black/5 active:bg-black/10 disabled:text-ink-disabled",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs [&_svg]:size-3.5",
  md: "h-[38px] px-3 text-sm [&_svg]:size-4",
  lg: "h-[46px] min-w-24 px-6 text-sm [&_svg]:size-4",
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
        "relative inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg font-semibold",
        "outline-none transition-colors duration-150 ease-out focus-visible:shadow-focus",
        "disabled:cursor-not-allowed",
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
      <span className={cn("inline-flex items-center gap-1", loading && "invisible")}>
        {children}
      </span>
    </button>
  ),
);

Button.displayName = "Button";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize };
