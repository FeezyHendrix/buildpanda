import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { channelKeys, messageKeys, notificationKeys } from "@/hooks/query-keys";
import { participantKeys } from "@/hooks/use-participants";
import { cacheMessages, deleteCachedMessage } from "@/lib/chat-cache";
import { playMessageChime } from "@/lib/notification-sound";
import {
  requestNotificationPermission,
  showDesktopNotification,
} from "@/lib/desktop-notification";
import { toast } from "@/lib/toast";
import type { ChatMessage, Channel } from "@/lib/project-types";

// Lazy import avoids a static cycle with @/App (which is rendered *inside*
// RealtimeProvider); the router is only needed when a notification is clicked.
function navigateTo(path: string): void {
  void import("@/App").then((m) => m.router.navigate(path));
}

type RealtimeEvent =
  | "message.created"
  | "message.updated"
  | "message.deleted"
  | "reaction.changed"
  | "typing"
  | "presence"
  | "read.updated"
  | "channel.updated"
  | "unread.changed"
  | "notification.created"
  | "row.updated"
  | "row.verified"
  | "row.rejected"
  | "geometry.updated"
  | "precon.progress"
  | "access.updated";

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
  const currentUserId = session?.user?.id ?? null;
  const currentUserIdRef = useRef<string | null>(currentUserId);
  currentUserIdRef.current = currentUserId;
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const subscribedRef = useRef<Set<string>>(new Set());
  const reconnectRef = useRef<number>(0);

  useEffect(() => {
    if (!signedIn) return;
    requestNotificationPermission();
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
        handleEvent(queryClient, payload, currentUserIdRef.current);
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

function onChatPage(): boolean {
  const path = window.location.pathname;
  return path.endsWith("/chat") || path.endsWith("/messages");
}

function notifyIncomingMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  message: ChatMessage,
  currentUserId: string | null,
): void {
  const channels = queryClient.getQueryData<Channel[]>(channelKeys.list()) ?? [];
  const channel = channels.find((c) => c.id === message.channelId);
  // Channel unknown means the channel list hasn't loaded yet — suppress rather
  // than risk pinging for a channel the user has muted but we can't see yet.
  if (!channel) return;
  if (channel.muted || channel.notifyLevel === "none") return;

  const mentioned = (message.mentions ?? []).some(
    (m) => (m.kind === "user" && m.userId === currentUserId) || m.kind === "here" || m.kind === "channel",
  );
  if (channel.notifyLevel === "mentions" && !mentioned) return;

  const author = message.authorName ?? "New message";
  const chars = Array.from(message.body);
  const preview = chars.length > 120 ? `${chars.slice(0, 120).join("")}…` : message.body;

  if (document.visibilityState === "hidden") {
    showDesktopNotification(author, preview);
    return;
  }

  if (!onChatPage()) {
    toast(`${author}: ${preview}`, "info", {
      onClick: channel.projectId ? () => navigateTo(`/project/${channel.projectId}/chat`) : undefined,
    });
  }
}

function handleEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  payload: RealtimePayload,
  currentUserId: string | null,
): void {
  if (payload.event === "message.created" && payload.channelId) {
    const message = payload.data as ChatMessage;
    if (message.authorId && message.authorId !== currentUserId) {
      playMessageChime();
      notifyIncomingMessage(queryClient, message, currentUserId);
    }
    if (message.parentMessageId) {
      void queryClient.invalidateQueries({ queryKey: ["messages", message.parentMessageId, "thread"] });
      void queryClient.invalidateQueries({ queryKey: messageKeys.list(payload.channelId) });
      return;
    }
    void cacheMessages(payload.channelId, [message]);
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
    if (payload.event === "message.deleted") {
      void deleteCachedMessage(message.id);
    } else {
      void cacheMessages(payload.channelId, [message]);
    }
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

  if (
    payload.event === "row.updated" ||
    payload.event === "row.verified" ||
    payload.event === "row.rejected" ||
    payload.event === "geometry.updated" ||
    payload.event === "precon.progress"
  ) {
    const sessionId = payload.channelId?.startsWith("precon:") ? payload.channelId.slice("precon:".length) : null;
    if (!sessionId) return;
    if (payload.event === "precon.progress") {
      const message = (payload.data as { message?: string }).message ?? "";
      queryClient.setQueryData<string[]>(["precon", "progress-feed", sessionId], (prev) =>
        [...(prev ?? []), message].slice(-50),
      );
    }
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey.includes("snapshot") && query.queryKey.includes(sessionId),
    });
    return;
  }

  if (payload.event === "notification.created") {
    const data = payload.data as { title?: string; body?: string };
    if (data.title) showDesktopNotification(data.title, data.body);
    void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    return;
  }

  if (payload.event === "unread.changed") {
    void queryClient.invalidateQueries({ queryKey: channelKeys.all });
    return;
  }

  if (payload.event === "access.updated") {
    const data = payload.data as { projectId?: string };
    if (data.projectId) {
      void queryClient.invalidateQueries({ queryKey: participantKeys.access(data.projectId) });
      void queryClient.invalidateQueries({ queryKey: participantKeys.myProjects() });
    }
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
