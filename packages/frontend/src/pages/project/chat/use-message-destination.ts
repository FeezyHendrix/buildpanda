import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { ChatMessage } from "@/lib/project-types";

export function useMessageDestination(messages: ChatMessage[], more: boolean, fetching: boolean, loadMore: () => unknown) {
  const [params] = useSearchParams();
  const target = params.get("message");
  const focused = useRef<string | null>(null);
  const found = messages.some(message => message.id === target);
  useEffect(() => {
    if (!target || focused.current === target || fetching) return;
    if (found) {
      const element = document.getElementById(`message-${target}`);
      element?.scrollIntoView({ block: "center" });
      element?.classList.add("bg-primary-50");
      focused.current = target;
    } else if (more) void loadMore();
  }, [target, found, more, fetching, loadMore]);
  return target && !found && !fetching && !more ? "This message is unavailable. You can still read the conversation." : null;
}
