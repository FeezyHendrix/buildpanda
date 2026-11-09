import { cn } from "@/lib/utils";
import { TEAM_TABS, type TeamTabId } from "./shared";

/** The two lists on this page: who has access, and who is simply on the contact sheet. */
export function TeamTabs({ value, onChange }: { value: TeamTabId; onChange: (id: TeamTabId) => void }) {
  return (
    <div role="tablist" aria-label="My team sections" className="inline-flex border border-[#E5E5E5] bg-[#F5F5F5] shadow-sm">
      {TEAM_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "h-[34px] px-[17px] text-[12px] font-medium text-[#1E1E1E] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-900/10",
            value === tab.id ? "bg-white" : "hover:bg-[#EFEFEF]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

TeamTabs.displayName = "TeamTabs";
