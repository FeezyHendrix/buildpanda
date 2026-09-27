import { cn } from "@/lib/utils";

export function RolePill({
  meta,
  selected,
  onSelect,
}: {
  meta: { label: string; description: string };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-all duration-150",
        selected ? "border-primary-500 bg-primary-50" : "border-line-hair hover:border-line-hover",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary-500 bg-primary-500" : "border-line",
        )}
      >
        {selected && (
          <svg viewBox="0 0 6 5" fill="none" className="h-2 w-2">
            <path
              d="M0.5 2.5l2 2 3-4"
              stroke="white"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <div className="flex flex-col">
        <span className={cn("text-sm font-semibold", selected ? "text-primary-600" : "text-ink")}>
          {meta.label}
        </span>
        <span className="mt-0.5 text-xs leading-relaxed text-ink-muted">{meta.description}</span>
      </div>
    </button>
  );
}
