import { ReactSVG } from "react-svg";
import { icons2 } from "@/assets/icons2/icon2";
import { cn } from "@/lib/utils";

interface ToolbarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Overrides on the field itself, e.g. a taller height. */
  inputClassName?: string;
  ariaLabel?: string;
}

/** The search box that leads a list's toolbar: a 40px square-cornered field with the search icon inside. */
export function ToolbarSearch({ value, onChange, placeholder = "Search", className, inputClassName, ariaLabel }: ToolbarSearchProps) {
  return (
    <div className={cn("relative w-full max-w-[340px]", className)}>
      <ReactSVG
        src={icons2.search}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 [&_svg]:size-[16px]"
      />
      <input
        type="search"
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-10 w-full border border-[#EBEBEB] bg-white pl-9 pr-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] outline-none focus:border-[#6B7280]", inputClassName)}
      />
    </div>
  );
}

ToolbarSearch.displayName = "ToolbarSearch";
