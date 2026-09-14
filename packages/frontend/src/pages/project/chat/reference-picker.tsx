import { useState, useEffect } from "react";
import { Spinner } from "@/components/atoms/spinner";
import { INPUT_SM_CLASS } from "@/components/atoms/input";
import { useReferenceSearch } from "@/hooks/use-chat";

export function ReferencePicker({
  onSelect,
  onClose,
}: {
  onSelect: (ref: { type: string; id: string; label: string }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useReferenceSearch(debouncedQuery);

  const typeLabels: Record<string, string> = {
    rfi: "RFI",
    action_item: "Action item",
    query: "Query",
    change_request: "Change request",
    activity: "Activity",
    task: "Task",
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-line bg-white shadow-card overflow-hidden flex flex-col z-10">
      <div className="p-2 border-b border-line-hair">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities..."
          className={INPUT_SM_CLASS}
        />
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {debouncedQuery.length < 2 ? (
          <div className="p-2 text-center text-xs text-ink-muted">Type 2+ chars to search</div>
        ) : isLoading ? (
          <div className="flex justify-center p-2">
            <Spinner size="xs" />
          </div>
        ) : !results?.length ? (
          <div className="p-2 text-center text-xs text-ink-muted">No results found</div>
        ) : (
          results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              onClick={() => {
                onSelect({ type: r.type, id: r.id, label: r.label });
                onClose();
              }}
              className="w-full flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-surface-alt"
            >
              <span className="truncate text-sm font-medium text-ink">{r.label}</span>
              <span className="ml-2 shrink-0 text-xs font-medium uppercase text-ink-muted">{typeLabels[r.type] || r.type}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}



