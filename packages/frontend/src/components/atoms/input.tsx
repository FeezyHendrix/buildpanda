import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/** The shared control shell for raw selects / textareas: the filled field. */
const INPUT_BASE_CLASS =
  "w-full rounded-lg bg-[#F6F6F6] font-sans text-base lg:text-sm text-gray-900 border-0 outline-none ring-0 placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-gray-900/10 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50";
const INPUT_CLASS = cn(INPUT_BASE_CLASS, "h-14 px-4");
/** Compact height for toolbars and inline table cells. */
const INPUT_SM_CLASS = cn(INPUT_BASE_CLASS, "h-11 px-3");

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  suffixIcon?: ReactNode;
  /** `sm` is the compact toolbar / inline height. */
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
        className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
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
            "flex",
            inputSize === "sm" ? INPUT_SM_CLASS : INPUT_CLASS,
            hasSuffix && "pr-11",
            className,
          )}
          {...props}
        />
        {isPassword && passwordToggle}
        {!isPassword && suffixIcon && (
          <span className="absolute inset-y-0 right-3 flex items-center text-gray-400 pointer-events-none">
            {suffixIcon}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input, INPUT_CLASS, INPUT_SM_CLASS, INPUT_BASE_CLASS, type InputProps };
