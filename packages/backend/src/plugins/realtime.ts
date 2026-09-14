import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import websocket from "@fastify/websocket";
import { config } from "../config/index.ts";
import { auth } from "../lib/auth.ts";
import { RealtimeHub } from "../lib/realtime/index.ts";
import { messagingRepository } from "../modules/messaging/repository.ts";

declare module "fastify" {
  interface FastifyInstance {
    realtime: RealtimeHub;
  }
}

function toHeaders(record: Record<string, unknown>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    headers.append(key, Array.isArray(value) ? value.join(", ") : String(value));
  }
  return headers;
}

const realtimePlugin: FastifyPluginAsync = async (fastify) => {
  const hub = new RealtimeHub(config.redis.url || null, fastify.log);
  fastify.decorate("realtime", hub);
  const repo = messagingRepository(fastify.db);

  // precon:<sessionId> channels authorize via membership of the organization
  // that owns the session (preconstruction is a sales-suite feature).
  const canJoinPreconChannel = async (sessionId: string, userId: string): Promise<boolean> => {
    const session = await fastify
      .db("precon_sessions")
      .where({ id: sessionId })
      .select<{ org_id: string }>("org_id")
      .first();
    if (!session) return false;
    const member = await fastify.db("member").where({ organizationId: session.org_id, userId }).first();
    return Boolean(member);
  };

  await fastify.register(websocket);

  // Presence on a precon channel follows the socket: joining the channel
  // announces the user, leaving it (or the socket closing) removes them.
  const isPreconChannel = (channelId: string): boolean => channelId.startsWith("precon:");
  const leavePresence = (channelId: string, userId: string): void => {
    const users = hub.presence.leave(channelId, userId);
    if (users) hub.publishPresence(channelId, users);
  };

  fastify.get("/ws", { websocket: true }, (socket, request) => {
    let userId: string | null = null;
    let userName = "";
    let conn: ReturnType<typeof hub.register> | null = null;
    const pending: string[] = [];
    let closed = false;

    const process = (text: string): void => {
      if (!userId || !conn) {
        pending.push(text);
        return;
      }
      let msg: { action?: string; channelId?: string };
      try {
        msg = JSON.parse(text) as { action?: string; channelId?: string };
      } catch {
        return;
      }
      if (msg.action === "subscribe" && msg.channelId) {
        const channelId = msg.channelId;
        const joiningUserId = userId;
        const authorize = isPreconChannel(channelId)
          ? canJoinPreconChannel(channelId.slice("precon:".length), userId)
          : repo.isMember(channelId, userId);
        void authorize
          .then((member) => {
            if (!member || !conn || closed) return;
            const alreadyOn = conn.channels.has(channelId);
            hub.subscribeChannel(conn, channelId);
            if (isPreconChannel(channelId) && !alreadyOn) {
              const users = hub.presence.join(channelId, { id: joiningUserId, name: userName });
              if (users) hub.publishPresence(channelId, users);
            }
          })
          .catch((err) => fastify.log.error({ err }, "ws subscribe authorization failed"));
      } else if (msg.action === "unsubscribe" && msg.channelId && conn) {
        const wasOn = conn.channels.has(msg.channelId);
        hub.unsubscribeChannel(conn, msg.channelId);
        if (wasOn && isPreconChannel(msg.channelId)) leavePresence(msg.channelId, userId);
      }
    };

    socket.on("message", (raw: Buffer) => process(raw.toString()));
    socket.on("close", () => {
      closed = true;
      if (!conn) return;
      for (const channelId of conn.channels) {
        if (isPreconChannel(channelId) && userId) leavePresence(channelId, userId);
      }
      hub.unregister(conn);
    });

    void auth.api
      .getSession({ headers: toHeaders(request.headers as Record<string, unknown>) })
      .catch(() => null)
      .then((session) => {
        if (!session?.user) {
          socket.close(1008, "Unauthorized");
          return;
        }
        if (closed) return;
        userId = session.user.id;
        userName = session.user.name ?? session.user.email ?? "";
        conn = hub.register(userId, socket);
        const queued = pending.splice(0);
        for (const text of queued) process(text);
      });
  });

  fastify.addHook("onClose", async () => {
    await hub.close();
  });

  fastify.log.info({ distributed: hub.distributed }, "Realtime hub ready");
};

export default fp(realtimePlugin, { name: "realtime", dependencies: ["database"] });
