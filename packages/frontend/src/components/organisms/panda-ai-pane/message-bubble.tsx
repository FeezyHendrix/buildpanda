import { cn } from "@/lib/utils";
import { Spinner } from "@/components/atoms/spinner";
import { FormattedMessage } from "./formatted-message";
import type { ChatMessage } from "@/hooks/use-panda-ai-chat";

export function MessageBubble({
  message,
  isLast,
  streaming,
  activeTool,
}: {
  message: ChatMessage;
  isLast: boolean;
  streaming: boolean;
  activeTool: string | null;
}) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[85%]",
        message.role === "user" ? "ml-auto justify-end" : "mr-auto justify-start",
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm shadow-sm",
          message.role === "user"
            ? "bg-[#004DE7] text-white"
            : "border border-[#EDEDED] bg-white text-gray-900",
        )}
      >
        {message.role === "assistant" ? (
          message.content ? (
            <FormattedMessage content={message.content} />
          ) : isLast && streaming && !activeTool ? (
            <Spinner size="sm" />
          ) : null
        ) : (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}
      </div>
    </div>
  );
}
