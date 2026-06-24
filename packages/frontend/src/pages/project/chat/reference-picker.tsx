import { useState, useEffect } from "react";
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
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden flex flex-col z-10">
      <div className="p-2 border-b border-gray-100">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entities..."
          className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
        />
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {debouncedQuery.length < 2 ? (
          <div className="p-2 text-center text-xs text-gray-500">Type 2+ chars to search</div>
        ) : isLoading ? (
          <div className="p-2 text-center text-xs text-gray-500">Loading...</div>
        ) : !results?.length ? (
          <div className="p-2 text-center text-xs text-gray-500">No results found</div>
        ) : (
          results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              onClick={() => {
                onSelect({ type: r.type, id: r.id, label: r.label });
                onClose();
              }}
              className="w-full flex items-center justify-between rounded-md px-3 py-2 text-left hover:bg-gray-50"
            >
              <span className="truncate text-sm font-medium text-gray-900">{r.label}</span>
              <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wider text-gray-500">{typeLabels[r.type] || r.type}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}



