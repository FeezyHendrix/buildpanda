import { ChevronRightIcon } from "./icons";
import { SUGGESTIONS } from "./constants";

export function SuggestionChips({ onSelect }: { onSelect: (suggestion: string) => void }) {
  return (
    <div className="flex h-full flex-col justify-end">
      <div className="mb-6 space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">How can I help?</h3>
        <p className="text-sm text-gray-600">
          I can analyze schedules, read daily logs, identify risks, and guide you through the project.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            className="flex w-full items-center justify-between rounded-lg border border-[#EDEDED] bg-white p-3 text-left text-sm text-gray-700 transition-colors hover:border-[#004DE7] hover:bg-blue-50 hover:text-[#004DE7]"
          >
            {suggestion}
            <ChevronRightIcon className="size-4 opacity-50" />
          </button>
        ))}
      </div>
    </div>
  );
}
