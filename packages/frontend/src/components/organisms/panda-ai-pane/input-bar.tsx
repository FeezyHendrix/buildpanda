import type { KeyboardEvent } from "react";
import { SendIcon, SquareIcon } from "./icons";

export function InputBar({
  input,
  setInput,
  streaming,
  onSend,
  onStop,
  onReset,
  hasMessages,
  error,
}: {
  input: string;
  setInput: (value: string) => void;
  streaming: boolean;
  onSend: () => void;
  onStop: () => void;
  onReset: () => void;
  hasMessages: boolean;
  error: string | null;
}) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-[#EDEDED] bg-white p-4">
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="relative flex items-end rounded-xl border border-[#EDEDED] bg-[#FCFCFD] p-1 focus-within:border-[#004DE7] focus-within:ring-1 focus-within:ring-[#004DE7]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Panda AI..."
          className="max-h-32 min-h-[44px] w-full resize-none bg-transparent py-3 pl-3 pr-12 text-sm text-gray-900 outline-none placeholder:text-gray-400 no-scrollbar"
          rows={1}
        />
        <div className="absolute bottom-2 right-2">
          {streaming ? (
            <button
              onClick={onStop}
              className="flex size-8 items-center justify-center rounded-lg bg-gray-900 text-white transition-colors hover:bg-gray-800"
              title="Stop generating"
            >
              <SquareIcon className="size-4" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!input.trim()}
              className="flex size-8 items-center justify-center rounded-lg bg-[#004DE7] text-white transition-colors hover:bg-[#0041c4] disabled:opacity-50 disabled:hover:bg-[#004DE7]"
            >
              <SendIcon className="ml-0.5 size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between px-1">
        <span className="text-[10px] text-gray-400">
          AI can make mistakes. Verify important info.
        </span>
        {hasMessages && (
          <button
            onClick={onReset}
            className="text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-900"
          >
            New chat
          </button>
        )}
      </div>
    </div>
  );
}
