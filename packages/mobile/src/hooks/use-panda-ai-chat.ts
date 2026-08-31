import { useCallback, useRef, useState } from "react";
import { streamChat, type ChatMessage } from "@/api/panda-ai";

export interface PandaAiChat {
  messages: ChatMessage[];
  streaming: boolean;
  activeTool: string | null;
  error: string | null;
  send: (text: string) => void;
  stop: () => void;
  reset: () => void;
}

export function usePandaAiChat(projectId: string | undefined): PandaAiChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setActiveTool(null);
  }, []);

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
  }, [stop]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming || !projectId) return;
      setError(null);

      const history: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      void streamChat(
        projectId,
        history,
        controller.signal,
        (chunk) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (!last || last.role !== "assistant") return prev;
            return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
          });
        },
        setActiveTool,
        () => {
          setStreaming(false);
          setActiveTool(null);
          abortRef.current = null;
        },
        (err) => {
          setError(err);
          setStreaming(false);
          setActiveTool(null);
          abortRef.current = null;
        },
      );
    },
    [messages, streaming, projectId],
  );

  return { messages, streaming, activeTool, error, send, stop, reset };
}
