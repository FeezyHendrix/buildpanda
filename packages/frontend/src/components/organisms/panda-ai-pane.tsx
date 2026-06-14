import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";
import { usePandaAiChat } from "@/hooks/use-panda-ai-chat";

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function SendIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function SquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </svg>
  );
}

function SparkleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

const TOOL_LABELS: Record<string, string> = {
  get_schedule: "Checking the schedule",
  get_delays: "Reviewing delays",
  get_risks: "Reviewing risks",
  get_finances: "Checking finances",
  get_daily_logs: "Reading daily logs",
  get_key_dates: "Checking key dates",
  get_inspections: "Checking inspections",
  get_materials: "Checking materials",
  list_documents: "Looking at documents",
  analyze_document: "Reading the document",
  analyze_drawing: "Looking at the drawing",
  navigate: "Finding the page",
};

const SUGGESTIONS = [
  "Where are we behind schedule?",
  "Summarize recent daily logs",
  "What are the top risks?",
  "Take me to the Gantt chart",
];

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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeToolLabel = activeTool ? TOOL_LABELS[activeTool] || "Thinking…" : null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          data-testid="panda-ai-fab"
          className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-[#004DE7] text-white shadow-lg transition-transform hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004DE7] focus-visible:ring-offset-2"
        >
          <SparkleIcon className="size-6" />
        </button>
      )}

      <div
        data-testid="panda-ai-pane"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[#FCFCFD] shadow-2xl transition-all duration-300",
          "lg:static lg:z-auto lg:shrink-0 lg:overflow-hidden lg:shadow-none lg:transition-[width]",
          open
            ? "translate-x-0 lg:w-[440px] lg:border-l lg:border-[#EDEDED]"
            : "translate-x-full lg:w-0 lg:translate-x-0 lg:border-none",
        )}
      >
        <div className="flex h-full w-full flex-col lg:w-[440px]">
          <div className="flex shrink-0 items-center justify-between border-b border-[#EDEDED] bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#004DE7]">
                <SparkleIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Panda AI</h2>
                <p className="text-xs text-gray-500">Project assistant</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              data-testid="panda-ai-collapse"
              className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <ChevronRightIcon className="size-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 no-scrollbar">
            {messages.length === 0 ? (
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
                      onClick={() => send(suggestion)}
                      className="flex w-full items-center justify-between rounded-lg border border-[#EDEDED] bg-white p-3 text-left text-sm text-gray-700 transition-colors hover:border-[#004DE7] hover:bg-blue-50 hover:text-[#004DE7]"
                    >
                      {suggestion}
                      <ChevronRightIcon className="size-4 opacity-50" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 pb-2">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex w-full max-w-[85%]",
                      msg.role === "user" ? "ml-auto justify-end" : "mr-auto justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                        msg.role === "user"
                          ? "bg-[#004DE7] text-white"
                          : "border border-[#EDEDED] bg-white text-gray-900",
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {msg.content ||
                            (idx === messages.length - 1 && streaming && !activeTool ? (
                              <Spinner size="sm" />
                            ) : (
                              ""
                            ))}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>
                  </div>
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
                    onClick={stop}
                    className="flex size-8 items-center justify-center rounded-lg bg-gray-900 text-white transition-colors hover:bg-gray-800"
                    title="Stop generating"
                  >
                    <SquareIcon className="size-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
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
              {messages.length > 0 && (
                <button
                  onClick={reset}
                  className="text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-900"
                >
                  New chat
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
