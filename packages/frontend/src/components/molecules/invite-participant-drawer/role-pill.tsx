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
        "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150",
        selected ? "border-brand bg-brand/5" : "border-[#EBEBEB] hover:border-gray-300",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-brand bg-brand" : "border-gray-300",
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
        <span className={cn("text-sm font-semibold", selected ? "text-brand" : "text-gray-900")}>
          {meta.label}
        </span>
        <span className="mt-0.5 text-xs leading-relaxed text-gray-500">{meta.description}</span>
      </div>
    </button>
  );
}
