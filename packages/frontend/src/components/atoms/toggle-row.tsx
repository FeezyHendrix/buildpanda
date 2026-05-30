import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ToggleSwitch } from "@/components/atoms/toggle-switch";

interface ToggleRowProps {
  icon?: ReactNode;
  title: string;
  description: string;
  badge?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function ToggleRow({
  icon,
  title,
  description,
  badge,
  checked,
  onChange,
  disabled = false,
  className,
}: ToggleRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border-2 border-[#F6F6F6] p-4 transition-colors hover:bg-gray-50",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex flex-1 items-center gap-4">
        {icon && <div className="shrink-0 text-gray-500">{icon}</div>}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {title}
            </span>
            {badge && (
              <span className="rounded-md bg-[#E8FCF4] px-2 py-0.5 text-xs font-semibold text-[#12A368]">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 text-pretty">
            {description}
          </p>
        </div>
      </div>

      <ToggleSwitch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

ToggleRow.displayName = "ToggleRow";

export { ToggleRow, type ToggleRowProps };
