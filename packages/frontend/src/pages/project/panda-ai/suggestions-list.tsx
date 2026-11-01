import type { AiSuggestion, SuggestionPriority } from "@/hooks/use-panda-ai";
import { cn } from "@/lib/utils";

const PRIORITY_WEIGHT: Record<SuggestionPriority, number> = { high: 3, medium: 2, low: 1 };

const PRIORITY_CLASS: Record<SuggestionPriority, string> = {
  high: "bg-[#FEF2F2] text-[#C10007]",
  medium: "bg-primary-50 text-primary",
  low: "bg-[#F5F5F5] text-gray-600",
};

const PRIORITY_LABEL: Record<SuggestionPriority, string> = { high: "High", medium: "Medium", low: "Low" };

export function SuggestionsList({ suggestions }: { suggestions: AiSuggestion[] }) {
  const sorted = [...suggestions].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);

  if (sorted.length === 0) {
    return (
      <div className="border-[0.5px] border-[#EBEBEB] bg-white px-6 py-4">
        <p className="text-sm text-gray-500">No suggestions available at this time.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {sorted.map((suggestion, index) => (
        <article key={index} className="border-[0.5px] border-[#EBEBEB] bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", PRIORITY_CLASS[suggestion.priority])}>
              {PRIORITY_LABEL[suggestion.priority]}
            </span>
            <span className="rounded-full border border-[#EBEBEB] bg-white px-2.5 py-1 text-xs font-medium text-black-500">
              {suggestion.category}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-black-500">{suggestion.title}</h3>
          <p className="mt-1 text-xs text-gray-500">{suggestion.detail}</p>
        </article>
      ))}
    </div>
  );
}

SuggestionsList.displayName = "SuggestionsList";
