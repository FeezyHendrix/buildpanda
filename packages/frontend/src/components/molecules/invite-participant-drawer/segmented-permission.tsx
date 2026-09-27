import { cn } from "@/lib/utils";
import type { SectionPermission } from "@/lib/project-types";

export function SegmentedPermission({
  value,
  onChange,
}: {
  value: SectionPermission;
  onChange: (v: SectionPermission) => void;
}) {
  const options: SectionPermission[] = ["hidden", "view", "edit"];
  return (
    <div className="flex rounded-lg bg-surface-track p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "flex-1 rounded-md py-1 text-xs font-medium capitalize transition-all duration-150",
            value === opt ? "bg-white text-ink shadow-card" : "text-ink-muted hover:text-ink",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
