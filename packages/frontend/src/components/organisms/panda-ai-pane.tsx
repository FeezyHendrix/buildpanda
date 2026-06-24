import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";
import { usePandaAiChat } from "@/hooks/use-panda-ai-chat";
import { PandaMarkIcon } from "./panda-ai-pane/icons";
import { TOOL_LABELS } from "./panda-ai-pane/constants";
import { PandaAiHeader } from "./panda-ai-pane/header";
import { SuggestionChips } from "./panda-ai-pane/suggestion-chips";
import { MessageBubble } from "./panda-ai-pane/message-bubble";
import { InputBar } from "./panda-ai-pane/input-bar";

export function PandaAiPane({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    messages,
    streaming,
    activeTool,
    pendingNavigate,
    error,
    send,
    stop,
    reset,
    clearNavigate,
  } = usePandaAiChat(projectId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming, activeTool]);

  const handleSend = () => {
    if (!input.trim() || streaming) return;
    send(input);
    setInput("");
  };

  const activeToolLabel = activeTool ? TOOL_LABELS[activeTool] || "Thinking…" : null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          data-testid="panda-ai-fab"
          title="Ask Panda AI about this project"
          aria-label="Open Panda AI assistant"
          className="group fixed bottom-6 right-6 z-50 flex size-14 cursor-pointer items-center justify-center rounded-full bg-[#004DE7] text-white shadow-lg transition-transform hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7] focus-visible:ring-offset-2"
        >
          <PandaMarkIcon className="h-7 w-auto" />
          <span className="pointer-events-none absolute bottom-full right-0 mb-3 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
            Ask Panda AI
          </span>
        </button>
      )}

      <div
        data-testid="panda-ai-pane"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[#FCFCFD] shadow-2xl transition-all duration-300",
          "lg:static lg:z-auto lg:h-full lg:shrink-0 lg:overflow-hidden lg:shadow-none lg:transition-[width]",
          open
            ? "translate-x-0 lg:w-[440px] lg:border-l lg:border-[#EDEDED]"
            : "translate-x-full lg:w-0 lg:translate-x-0 lg:border-none",
        )}
      >
        <div className="flex h-full w-full flex-col lg:w-[440px]">
          <PandaAiHeader onClose={() => setOpen(false)} />

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 no-scrollbar">
            {messages.length === 0 ? (
              <SuggestionChips onSelect={send} />
            ) : (
              <div className="flex flex-col gap-6 pb-2">
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={idx}
                    message={msg}
                    isLast={idx === messages.length - 1}
                    streaming={streaming}
                    activeTool={activeTool}
                  />
                ))}

                {activeToolLabel && (
                  <div className="mr-auto flex max-w-[85%] items-center gap-2 rounded-full border border-[#EDEDED] bg-white px-3 py-1.5 text-xs text-gray-500 shadow-sm">
                    <Spinner size="sm" />
                    {activeToolLabel}
                  </div>
                )}

                {pendingNavigate && (
                  <div className="mr-auto flex w-full max-w-[85%] flex-col gap-2 rounded-xl border border-[#EDEDED] bg-white p-3 shadow-sm">
                    <p className="text-sm font-medium text-gray-900">
                      I can take you to that page.
                    </p>
                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full"
                      onClick={() => {
                        navigate(pendingNavigate);
                        clearNavigate();
                      }}
                    >
                      Open page →
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <InputBar
            input={input}
            setInput={setInput}
            streaming={streaming}
            onSend={handleSend}
            onStop={stop}
            onReset={reset}
            hasMessages={messages.length > 0}
            error={error}
          />
        </div>
      </div>
    </>
  );
}
