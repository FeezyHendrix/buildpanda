import { cn } from "@/lib/utils";

type SwitcherValue = "yes" | "no";

interface SwitcherProps {
  value: SwitcherValue;
  onChange: (value: SwitcherValue) => void;
  className?: string;
}

function Switcher({ value, onChange, className }: SwitcherProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0 rounded-lg bg-gray-100 p-0.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange("yes")}
        className={cn(
          "rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors select-none",
          "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
          value === "yes"
            ? "bg-white text-gray-900 shadow-sm"
            : "bg-transparent text-gray-400",
        )}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange("no")}
        className={cn(
          "rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors select-none",
          "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
          value === "no"
            ? "bg-white text-gray-900 shadow-sm"
            : "bg-transparent text-gray-400",
        )}
      >
        No
      </button>
    </div>
  );
}

Switcher.displayName = "Switcher";

export { Switcher, type SwitcherProps, type SwitcherValue };
