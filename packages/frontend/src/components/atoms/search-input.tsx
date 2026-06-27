import { forwardRef, type InputHTMLAttributes } from "react";
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

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, placeholder = "Search", ...props }, ref) => (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
        <SearchIcon />
      </span>
      <input
        ref={ref}
        type="search"
        placeholder={placeholder}
        className={cn(
          "flex h-11 w-full rounded-lg bg-transparent pl-10 pr-4 font-sans text-base lg:text-sm text-gray-900",
          "border-0 outline-none ring-0",
          "placeholder:text-gray-400",
          "focus-visible:ring-2 focus-visible:ring-gray-900/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  ),
);

SearchInput.displayName = "SearchInput";

export { SearchInput, type SearchInputProps };
