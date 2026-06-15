import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { channelKeys, messageKeys } from "@/hooks/query-keys";
import type { ChatMessage } from "@/lib/project-types";

type RealtimeEvent =
  | "message.created"
  | "message.updated"
  | "message.deleted"
  | "reaction.changed"
  | "typing"
  | "presence"
  | "read.updated"
  | "channel.updated"
  | "unread.changed";

interface RealtimePayload {
  event: RealtimeEvent;
  channelId?: string;
  userId?: string;
  data: unknown;
}

interface RealtimeContextValue {
  connected: boolean;
  subscribe: (channelId: string) => void;
  unsubscribe: (channelId: string) => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  subscribe: () => {},
  unsubscribe: () => {},
});

function wsUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL || window.location.origin;
  const url = new URL(base, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  return url.toString();
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const reconnectRef = useRef<number>(0);

  useEffect(() => {
    if (!signedIn) return;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = (): void => {
      const ws = new WebSocket(wsUrl());
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectRef.current = 0;
        for (const channelId of subscribedRef.current) {
          ws.send(JSON.stringify({ action: "subscribe", channelId }));
        }
      };

      ws.onmessage = (ev) => {
        let payload: RealtimePayload;
        try {
          payload = JSON.parse(ev.data as string) as RealtimePayload;
        } catch {
          return;
        }
        handleEvent(queryClient, payload);
      };

      ws.onclose = () => {
        setConnected(false);
        socketRef.current = null;
        if (closed) return;
        reconnectRef.current = Math.min(reconnectRef.current + 1, 6);
        const delay = Math.min(1000 * 2 ** reconnectRef.current, 15000);
        retryTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [signedIn, queryClient]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      connected,
      subscribe: (channelId: string) => {
        subscribedRef.current.add(channelId);
        const ws = socketRef.current;
        if (ws && ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ action: "subscribe", channelId }));
        }
      },
      unsubscribe: (channelId: string) => {
        subscribedRef.current.delete(channelId);
        const ws = socketRef.current;
        if (ws && ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ action: "unsubscribe", channelId }));
        }
      },
    }),
    [connected],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

function handleEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  payload: RealtimePayload,
): void {
  if (payload.event === "message.created" && payload.channelId) {
    const message = payload.data as ChatMessage;
    queryClient.setQueryData<{ pages: ChatMessage[][]; pageParams: unknown[] } | undefined>(
      messageKeys.list(payload.channelId),
      (prev) => {
        if (!prev) return prev;
        const exists = prev.pages.some((page) => page.some((m) => m.id === message.id));
        if (exists) return prev;
        const pages = prev.pages.slice();
        const lastIndex = pages.length - 1;
        pages[lastIndex] = [...(pages[lastIndex] ?? []), message];
        return { ...prev, pages };
      },
    );
    void queryClient.invalidateQueries({ queryKey: channelKeys.all });
    return;
  }

  if (
    (payload.event === "message.updated" || payload.event === "message.deleted") &&
    payload.channelId
  ) {
    const message = payload.data as ChatMessage;
    queryClient.setQueryData<{ pages: ChatMessage[][]; pageParams: unknown[] } | undefined>(
      messageKeys.list(payload.channelId),
      (prev) => {
        if (!prev) return prev;
        const pages = prev.pages.map((page) =>
          page.map((m) => (m.id === message.id ? message : m)),
        );
        return { ...prev, pages };
      },
    );
    return;
  }

  if (payload.event === "unread.changed") {
    void queryClient.invalidateQueries({ queryKey: channelKeys.all });
  }
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

export function useChannelRealtime(channelId: string | undefined): void {
  const { subscribe, unsubscribe } = useRealtime();
  useEffect(() => {
    if (!channelId) return;
    subscribe(channelId);
    return () => unsubscribe(channelId);
  }, [channelId, subscribe, unsubscribe]);
}
