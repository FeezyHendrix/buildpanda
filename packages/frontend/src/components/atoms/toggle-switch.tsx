import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  /** `sm` is the slim 34×18 switch used inside compact dialogs. */
  size?: "default" | "sm";
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  className,
  ariaLabel,
  size = "default",
}: ToggleSwitchProps) {
  const small = size === "sm";
  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors",
        small ? "h-[18px] w-[34px]" : "h-6 w-11",
        "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
        checked ? "bg-[#004DE7]" : "bg-gray-200",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform",
          small ? "size-[14px]" : "size-4",
          small ? (checked ? "translate-x-[18px]" : "translate-x-[2px]") : checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

ToggleSwitch.displayName = "ToggleSwitch";

export { ToggleSwitch, type ToggleSwitchProps };
