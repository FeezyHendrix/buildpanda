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
    <div className={cn("grid grid-cols-3 gap-3 md:grid-cols-6", className)}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-lg px-3 py-3 text-center text-sm font-medium transition-colors",
            "outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
            value === opt.id
              ? "bg-[#F0F4FF] text-[#004DE7]"
              : "bg-[#F6F6F6] text-gray-700 hover:bg-gray-200",
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
