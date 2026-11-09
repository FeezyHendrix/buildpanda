import { Platform } from "react-native";
import { API_BASE_URL, authClient } from "@/lib/auth-client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SseEvent {
  event: string;
  data: unknown;
}

export function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
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

export async function streamChat(
  projectId: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  onChunk: (text: string) => void,
  onTool: (name: string | null) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (Platform.OS !== "web") headers.cookie = authClient.getCookie();

  try {
    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/ai/chat`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ messages }),
      signal,
    });

    if (!response.ok) {
      onError(`Panda AI returned ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) { onError("No response stream"); return; }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseChunk(buffer);
      buffer = rest;

      for (const ev of events) {
        if (ev.event === "token") {
          const d = ev.data as { text?: string };
          if (d.text) onChunk(d.text);
        } else if (ev.event === "tool") {
          const d = ev.data as { name?: string };
          onTool(d.name ?? null);
        } else if (ev.event === "navigate") {
          continue;
        } else if (ev.event === "done") {
          onDone();
          return;
        } else if (ev.event === "error") {
          onError((ev.data as { message?: string }).message ?? "Unknown error");
          return;
        }
      }
    }
    onDone();
  } catch (err) {
    if (signal.aborted) return;
    onError(err instanceof Error ? err.message : "Connection failed");
  }
}
