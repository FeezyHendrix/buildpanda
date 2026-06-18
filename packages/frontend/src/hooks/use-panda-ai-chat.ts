import { useCallback, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PandaAiChat {
  messages: ChatMessage[];
  streaming: boolean;
  activeTool: string | null;
  pendingNavigate: string | null;
  error: string | null;
  send: (text: string) => void;
  stop: () => void;
  reset: () => void;
  clearNavigate: () => void;
}

function parseSseChunk(
  buffer: string,
): { events: Array<{ event: string; data: unknown }>; rest: string } {
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    let event = "message";
    let dataLine = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
    }
    if (!dataLine) continue;
    try {
      events.push({ event, data: JSON.parse(dataLine) });
    } catch {
      continue;
    }
  }
  return { events, rest };
}

export function usePandaAiChat(projectId: string): PandaAiChat {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [pendingNavigate, setPendingNavigate] = useState<string | null>(null);
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
    setPendingNavigate(null);
  }, [stop]);

  const clearNavigate = useCallback(() => setPendingNavigate(null), []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      setError(null);
      setPendingNavigate(null);

      const history: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const appendAssistant = (token: string) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { role: "assistant", content: last.content + token };
          }
          return next;
        });
      };

      void (async () => {
        try {
          const response = await fetch(`${API_BASE}/projects/${projectId}/ai/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal,
            body: JSON.stringify({ messages: history }),
          });
          if (!response.ok || !response.body) {
            throw new Error(`Panda AI request failed (${response.status})`);
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const { events, rest } = parseSseChunk(buffer);
            buffer = rest;
            for (const { event, data } of events) {
              if (event === "token") appendAssistant((data as { text: string }).text);
              else if (event === "tool") setActiveTool((data as { name: string }).name);
              else if (event === "navigate") setPendingNavigate((data as { path: string }).path);
              else if (event === "error") setError((data as { message: string }).message);
            }
          }
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            setError(err instanceof Error ? err.message : "Panda AI failed to respond.");
          }
        } finally {
          setStreaming(false);
          setActiveTool(null);
          abortRef.current = null;
        }
      })();
    },
    [messages, projectId, streaming],
  );

  return { messages, streaming, activeTool, pendingNavigate, error, send, stop, reset, clearNavigate };
}
