import { cn } from "@/lib/utils";

interface TimelineOption {
  id: string;
  label: string;
}

interface TimelinePickerProps {
  options: readonly TimelineOption[];
  value: string | null;
  onChange: (value: string) => void;
  className?: string;
}

function TimelinePicker({
  options,
  value,
  onChange,
  className,
}: TimelinePickerProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-6", className)}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-lg px-3 py-3 text-center text-sm font-medium transition-colors",
            "outline-none focus-visible:shadow-focus",
            value === opt.id
              ? "bg-primary-50 text-primary border border-primary"
              : "bg-surface-alt text-gray-700 hover:bg-gray-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

TimelinePicker.displayName = "TimelinePicker";

export { TimelinePicker, type TimelinePickerProps, type TimelineOption };
