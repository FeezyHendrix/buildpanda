import { cn } from "@/lib/utils";
import { Button } from "../atoms";

export interface PermissionActionOption {
  key: string;
  label: string;
  selected: boolean;
  /** Greyed and not clickable, with `disabledHint` as the reason. */
  disabled?: boolean;
  disabledHint?: string;
}

export interface PermissionRowOption {
  key: string;
  label: string;
  actions: PermissionActionOption[];
}

interface PermissionGroupCardProps {
  title: string;
  rows: PermissionRowOption[];
  onToggle: (resource: string, action: string, next: boolean) => void;
}

/**
 * One area of the project's permissions: a banded title, then a row per
 * resource with its actions as pills. A lit pill is granted; click to toggle.
 */
export function PermissionGroupCard({ title, rows, onToggle }: PermissionGroupCardProps) {
  return (
    <section aria-label={title} className="border border-[#EFEFEF] bg-white">
      <h3 className="bg-[#F5F5F5] px-[24px] py-[6px] text-[16px] font-medium leading-[24px] text-[#1E1E1E]">{title}</h3>
      <ul className="divide-y divide-[#F6F6F6]">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col justify-center gap-2 px-[24px] py-[8px] sm:h-[40px] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
            <span className="text-caption-l! text-[#1E1E1E]">{row.label}</span>
            <div role="group" aria-label={`${row.label} permissions`} className="flex flex-wrap gap-2">
              {row.actions.map((action) => (
                <Button
                  key={action.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={action.selected}
                  disabled={action.disabled}
                  title={action.disabled ? action.disabledHint : undefined}
                  onClick={() => onToggle(row.key, action.key, !action.selected)}
                  className={cn(
                    "h-[24px] rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50",
                    action.selected
                      ? "border-transparent bg-[#E6EDFD] text-primary"
                      : "border-[#EEEEEE] bg-white text-[#1E1E1E] hover:bg-[#F5F5F5]",
                  )}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

PermissionGroupCard.displayName = "PermissionGroupCard";
