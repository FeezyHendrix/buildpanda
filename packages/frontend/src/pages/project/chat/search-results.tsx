import { Avatar } from "@/components/atoms/avatar";
import { formatTimeAgo } from "@/lib/formatters";
import type { ChatMessage } from "@/lib/project-types";

/** The panel of messages that match a search; picking one jumps to its channel. */
export function SearchResults({
  results,
  isFetching,
  onSelect,
}: {
  results: ChatMessage[] | undefined;
  isFetching: boolean;
  onSelect: (channelId: string) => void;
}) {
  return (
    <div className="max-h-[min(24rem,60dvh)] overflow-y-auto border border-[#EEEEEE] bg-white p-2 shadow-lg">
      {isFetching ? (
        <div className="p-4 text-center text-sm text-ink-muted">Searching...</div>
      ) : results && results.length > 0 ? (
        <div className="space-y-1">
          {results.map((msg) => (
            <button
              key={msg.id}
              type="button"
              onClick={() => onSelect(msg.channelId)}
              className="flex w-full flex-col items-start gap-1 p-2 text-left transition-colors hover:bg-surface-alt"
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Avatar name={msg.authorName ?? "?"} size="sm" />
                  <span className="text-xs font-medium text-ink">{msg.authorName}</span>
                </div>
                <span className="text-[10px] text-ink-muted">{formatTimeAgo(msg.createdAt)}</span>
              </div>
              <p className="line-clamp-2 w-full text-xs text-ink">{msg.body}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-4 text-center text-sm text-ink-muted">No messages found</div>
      )}
    </div>
  );
}

SearchResults.displayName = "SearchResults";
