import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * The one outlined control shell — shared by Input, raw `<select>` / `<textarea>`
 * elements and the pickers so every field reads the same: white, hairline
 * border, brand border + 4px ring on focus. `INPUT_SM_CLASS` is the 38px
 * toolbar height; the default is the 46px form height.
 */
const INPUT_BASE_CLASS =
  "w-full rounded-lg border border-line bg-white font-sans text-sm text-ink placeholder:text-ink-muted outline-none transition-colors hover:border-line-hover focus:border-primary-500 focus:shadow-focus aria-[invalid=true]:border-negative-500 aria-[invalid=true]:shadow-none disabled:cursor-not-allowed disabled:border-line-disabled disabled:bg-surface-alt disabled:text-ink-disabled";
const INPUT_CLASS = cn(INPUT_BASE_CLASS, "h-[46px] px-3");
const INPUT_SM_CLASS = cn(INPUT_BASE_CLASS, "h-[38px] px-3");

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  suffixIcon?: ReactNode;
  /** `sm` is the 38px toolbar/filter height; default is the 46px form height. */
  inputSize?: "sm" | "md";
}

const EyeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
  >
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx={12} cy={12} r={3} />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
  >
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </svg>
);

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, suffixIcon, inputSize = "md", ...props }, ref) => {
    const isPassword = type === "password";
    const [visible, setVisible] = useState(false);

    const resolvedType = isPassword && visible ? "text" : type;

    const passwordToggle = isPassword ? (
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-3 flex items-center text-ink-muted hover:text-ink"
        onClick={() => setVisible((v) => !v)}
      >
        {suffixIcon ?? (visible ? <EyeOffIcon /> : <EyeIcon />)}
      </button>
    ) : null;

    const hasSuffix = isPassword || suffixIcon;

    return (
      <div className="relative">
        <input
          ref={ref}
          type={resolvedType}
          className={cn(
            inputSize === "sm" ? INPUT_SM_CLASS : INPUT_CLASS,
            hasSuffix && "pr-11",
            className,
          )}
          {...props}
        />
        {isPassword && passwordToggle}
        {!isPassword && suffixIcon && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted [&>svg]:size-5">
            {suffixIcon}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input, INPUT_CLASS, INPUT_SM_CLASS, INPUT_BASE_CLASS, type InputProps };
