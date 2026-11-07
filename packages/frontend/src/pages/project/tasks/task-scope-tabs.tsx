import { cn } from "@/lib/utils";

export type TaskBoardScope = "assigned" | "all";

const SCOPE_TABS: { value: TaskBoardScope; label: string }[] = [
  { value: "assigned", label: "For me" },
  { value: "all", label: "All Tasks" },
];

export function TaskScopeTabs({
  value,
  onChange,
}: {
  value: TaskBoardScope;
  onChange: (next: TaskBoardScope) => void;
}) {
  return (
    <div className="inline-flex items-center border-[0.5px] border-border bg-white">
      {SCOPE_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            "h-9 px-4 text-[13px] font-medium transition-colors",
            value === tab.value
              ? "bg-primary text-white"
              : "text-[#131B2E] hover:bg-black/5",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

TaskScopeTabs.displayName = "TaskScopeTabs";
