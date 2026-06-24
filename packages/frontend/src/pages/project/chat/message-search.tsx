import { useState, useEffect } from "react";
import { useMessageSearch } from "@/hooks/use-chat";
import { SearchIcon } from "@/components/atoms/chat-icons";
import { Avatar } from "@/components/atoms/avatar";
import { formatTimeAgo } from "@/lib/formatters";

export function MessageSearch({ onSelect }: { onSelect: (channelId: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useMessageSearch(debouncedQuery);

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className="relative flex min-w-[280px] items-center rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-left text-sm text-gray-400 transition-colors hover:border-primary-300">
        <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        Search messages...
      </button>
    );
  }

  return (
    <div className="relative z-10 flex items-center">
      <div className="flex items-center rounded-lg border border-gray-200 bg-white px-2 py-1">
        <SearchIcon className="size-4 text-gray-400" />
        <input
          autoFocus
          className="w-64 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-gray-400"
          placeholder="Search messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setQuery("");
            setDebouncedQuery("");
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {debouncedQuery.length >= 2 && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          {isFetching ? (
            <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
          ) : results && results.length > 0 ? (
            <div className="space-y-1">
              {results.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => {
                    onSelect(msg.channelId);
                    setIsOpen(false);
                    setQuery("");
                    setDebouncedQuery("");
                  }}
                  className="flex w-full flex-col items-start gap-1 rounded-md p-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Avatar name={msg.authorName ?? "?"} size="sm" />
                      <span className="text-xs font-medium text-gray-900">{msg.authorName}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{formatTimeAgo(msg.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 w-full text-xs text-gray-600">{msg.body}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500">No messages found</div>
          )}
        </div>
      )}
    </div>
  );
}
