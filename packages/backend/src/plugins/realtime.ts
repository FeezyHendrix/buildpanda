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

  await fastify.register(websocket);

  fastify.get("/ws", { websocket: true }, (socket, request) => {
    let userId: string | null = null;
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
        void repo
          .isMember(channelId, userId)
          .then((member) => {
            if (member && conn) hub.subscribeChannel(conn, channelId);
          })
          .catch((err) => fastify.log.error({ err }, "ws subscribe isMember failed"));
      } else if (msg.action === "unsubscribe" && msg.channelId && conn) {
        hub.unsubscribeChannel(conn, msg.channelId);
      }
    };

    socket.on("message", (raw: Buffer) => process(raw.toString()));
    socket.on("close", () => {
      closed = true;
      if (conn) hub.unregister(conn);
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
