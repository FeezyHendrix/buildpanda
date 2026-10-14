import IORedis, { type Redis } from "ioredis";
import type { FastifyBaseLogger } from "fastify";
import type { WebSocket } from "ws";
import { PresenceTracker, type PresentUser } from "./presence.ts";

export type RealtimeEvent =
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
  | "row.created"
  | "row.updated"
  | "row.verified"
  | "row.rejected"
  | "row.deleted"
  | "geometry.updated"
  | "workbook.updated"
  | "precon.progress"
  | "precon.presence"
  | "access.updated";

export interface RealtimePayload {
  event: RealtimeEvent;
  channelId?: string;
  userId?: string;
  data: unknown;
}

interface Socket {
  userId: string;
  send: (data: string) => void;
  channels: Set<string>;
  authorize?: (payload: RealtimePayload) => Promise<boolean>;
  delivery: Promise<void>;
}

const REDIS_CHANNEL = "buildpanda:realtime";

export class RealtimeHub {
  private readonly sockets = new Set<Socket>();
  private readonly byUser = new Map<string, Set<Socket>>();
  private readonly publisher: Redis | null;
  private readonly subscriber: Redis | null;

  readonly distributed: boolean;
  // who is on each precon:<sessionId> channel; per process, like the sockets
  readonly presence = new PresenceTracker();

  constructor(redisUrl: string | null, private readonly logger: FastifyBaseLogger) {
    if (redisUrl) {
      this.publisher = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      this.subscriber = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      this.subscriber.on("error", (err) => this.logger.error({ err }, "Realtime subscriber error"));
      this.publisher.on("error", (err) => this.logger.error({ err }, "Realtime publisher error"));
      void this.subscriber.subscribe(REDIS_CHANNEL);
      this.subscriber.on("message", (_channel, raw) => {
        try {
          this.deliverLocal(JSON.parse(raw) as RealtimePayload);
        } catch (err) {
          this.logger.error({ err }, "Realtime message parse failed");
        }
      });
      this.distributed = true;
    } else {
      this.publisher = null;
      this.subscriber = null;
      this.distributed = false;
    }
  }

  register(userId: string, ws: WebSocket, authorize?: Socket["authorize"]): Socket {
    const socket: Socket = {
      userId,
      send: (data) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      },
      channels: new Set(),
      authorize, delivery: Promise.resolve(),
    };
    this.sockets.add(socket);
    const set = this.byUser.get(userId) ?? new Set<Socket>();
    set.add(socket);
    this.byUser.set(userId, set);
    return socket;
  }

  unregister(socket: Socket): void {
    this.sockets.delete(socket);
    const set = this.byUser.get(socket.userId);
    if (set) {
      set.delete(socket);
      if (set.size === 0) this.byUser.delete(socket.userId);
    }
  }

  subscribeChannel(socket: Socket, channelId: string): void {
    socket.channels.add(channelId);
  }

  unsubscribeChannel(socket: Socket, channelId: string): void {
    socket.channels.delete(channelId);
  }

  isOnline(userId: string): boolean {
    return this.byUser.has(userId);
  }

  publishPresence(channelId: string, users: PresentUser[]): void {
    this.publish({ event: "precon.presence", channelId, data: { type: "precon.presence", users } });
  }

  publish(payload: RealtimePayload): void {
    if (this.publisher) {
      void this.publisher.publish(REDIS_CHANNEL, JSON.stringify(payload)).catch((err) => {
        this.logger.error({ err }, "Realtime publish failed");
      });
    } else {
      this.deliverLocal(payload);
    }
  }

  private deliverLocal(payload: RealtimePayload): void {
    const raw = JSON.stringify(payload);
    if (payload.userId) {
      for (const socket of this.byUser.get(payload.userId) ?? []) this.sendAuthorized(socket, raw, payload);
      return;
    }
    if (payload.channelId) {
      for (const socket of this.sockets) {
        if (socket.channels.has(payload.channelId)) this.sendAuthorized(socket, raw, payload);
      }
    }
  }

  private sendAuthorized(socket: Socket, raw: string, payload: RealtimePayload): void {
    if (!socket.authorize) { socket.send(raw); return; }
    // Preserve message order while authorization reads the current grants.
    socket.delivery = socket.delivery.then(async () => {
      if (!this.sockets.has(socket)) return;
      if (await socket.authorize!(payload)) {
        if (this.sockets.has(socket) && (!payload.channelId || payload.userId || socket.channels.has(payload.channelId))) socket.send(raw);
      } else if (payload.channelId) socket.channels.delete(payload.channelId);
    }).catch((error: unknown) => this.logger.error({ err: error }, "Realtime authorization failed"));
  }

  async close(): Promise<void> {
    if (this.subscriber) await this.subscriber.quit();
    if (this.publisher) await this.publisher.quit();
  }
}

export type RealtimeSocket = Socket;
