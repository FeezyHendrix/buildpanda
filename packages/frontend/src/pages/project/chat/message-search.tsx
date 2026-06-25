import { useState, useEffect } from "react";
import { useMessageSearch } from "@/hooks/use-chat";
import { SearchIcon } from "@/components/atoms/chat-icons";
import { Avatar } from "@/components/atoms/avatar";
import { formatTimeAgo } from "@/lib/formatters";

export function MessageSearch({ onSelect }: { onSelect: (channelId: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useMessageSearch(debouncedQuery);

  function handleClose() {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      setQuery("");
      setDebouncedQuery("");
    }, 160);
  }

  if (!isOpen) {
    return (
      <>
        {/* Desktop: pill button */}
        <button type="button" onClick={() => setIsOpen(true)} className="relative hidden min-w-[280px] items-center rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-left text-sm text-gray-400 transition-colors hover:border-primary-300 lg:flex">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          Search messages...
        </button>
        {/* Mobile: icon only — hidden when input is open */}
        <button type="button" onClick={() => setIsOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden" aria-label="Search messages">
          <SearchIcon className="size-5" />
        </button>
      </>
    );
  }

  return (
    <>
      {/* Mobile: icon placeholder keeps layout; hidden on desktop */}
      <div className="h-8 w-8 lg:hidden" aria-hidden />

      {/* Positioning layer: centered below header on mobile, inline on desktop */}
      <div className="absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 lg:static lg:z-10 lg:translate-x-0">
        {/* Animation layer */}
        <div className={isClosing ? "[animation:search-slide-out_160ms_ease-in_forwards]" : "[animation:search-slide-in_180ms_ease-out]"}>
          <div className="flex w-[calc(100vw-2rem)] max-w-[360px] items-center rounded-xl border border-gray-200 bg-white px-2 py-1 shadow-lg lg:w-auto lg:rounded-lg lg:shadow-none">
            <SearchIcon className="size-4 shrink-0 text-gray-400" />
            <input
              autoFocus
              className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-gray-400 lg:w-64 lg:flex-none"
              placeholder="Search messages..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" onClick={handleClose} className="shrink-0 text-gray-400 transition-colors hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {debouncedQuery.length >= 2 && (
            <div className="absolute left-1/2 mt-2 w-[calc(100vw-2rem)] max-w-[360px] -translate-x-1/2 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg lg:right-0 lg:left-auto lg:w-96 lg:translate-x-0">
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
                        handleClose();
                      }}
                      className="flex w-full flex-col items-start gap-1 rounded-md p-2 text-left transition-colors hover:bg-gray-50"
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
      </div>
    </>
  );
}
