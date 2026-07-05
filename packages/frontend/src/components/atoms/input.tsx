import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  suffixIcon?: ReactNode;
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
  ({ className, type, suffixIcon, ...props }, ref) => {
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
            "flex h-14 w-full rounded-lg bg-[#F6F6F6] px-4 font-sans text-base lg:text-sm text-gray-900",
            "border-0 outline-none ring-0",
            "placeholder:text-gray-400",
            "focus-visible:ring-2 focus-visible:ring-gray-900/10",
            "disabled:cursor-not-allowed disabled:opacity-50",
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

export { Input, type InputProps };
