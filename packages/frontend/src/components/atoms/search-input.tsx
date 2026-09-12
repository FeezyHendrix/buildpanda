import { forwardRef, type InputHTMLAttributes } from "react";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

const SearchIcon = () => (
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
    <circle cx={11} cy={11} r={8} />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

/** The toolbar search: 38px, outlined, leading icon. Toolbars pin it to 300px. */
const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, placeholder = "Search", ...props }, ref) => (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-ink-muted">
        <SearchIcon />
      </span>
      <input
        ref={ref}
        type="search"
        placeholder={placeholder}
        className={cn(INPUT_SM_CLASS, "pl-9 pr-3", className)}
        {...props}
      />
    </div>
  ),
);

SearchInput.displayName = "SearchInput";

export { SearchInput, type SearchInputProps };
