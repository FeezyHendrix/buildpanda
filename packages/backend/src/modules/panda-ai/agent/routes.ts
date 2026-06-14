import type { FastifyPluginAsync } from "fastify";
import { config } from "../../../config/index.ts";
import { agentService } from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const chatBody = {
  type: "object",
  required: ["messages"],
  additionalProperties: false,
  properties: {
    messages: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        required: ["role", "content"],
        additionalProperties: false,
        properties: {
          role: { type: "string", enum: ["user", "assistant"] },
          content: { type: "string", maxLength: 8000 },
        },
      },
    },
  },
} as const;

interface ChatBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

const agentRoutes: FastifyPluginAsync = async (fastify) => {
  const service = agentService(fastify.db);

  fastify.post<{ Params: { id: string }; Body: ChatBody }>(
    "/projects/:id/ai/chat",
    { schema: { params: projectIdParams, body: chatBody } },
    async (request, reply) => {
      const project = await request.requireProjectAccess(request.params.id);

      reply.hijack();
      const raw = reply.raw;
      const origin = request.headers.origin;
      const allowOrigin =
        origin && config.http.corsOrigins.includes(origin) ? origin : config.http.corsOrigins[0];
      raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Content-Encoding": "identity",
        ...(allowOrigin
          ? {
              "Access-Control-Allow-Origin": allowOrigin,
              "Access-Control-Allow-Credentials": "true",
              Vary: "Origin",
            }
          : {}),
      });

      const send = (event: string, data: unknown): void => {
        raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      if (!service.isConfigured()) {
        send("token", {
          text: "Panda AI is not configured on this server. Ask an administrator to set the OPENAI_API_KEY (or KIMI_API_KEY) environment variable.",
        });
        send("done", { navigate: null });
        raw.end();
        return;
      }

      const abort = new AbortController();
      request.raw.on("close", () => abort.abort());

      try {
        const result = await service.run(
          { projectId: project.id, messages: request.body.messages },
          {
            onToken: (text) => send("token", { text }),
            onTool: (name) => send("tool", { name }),
            onNavigate: (path) => send("navigate", { path }),
          },
          abort.signal,
        );
        send("done", { navigate: result.navigate });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Panda AI failed to respond.";
        send("error", { message });
      } finally {
        raw.end();
      }
    },
  );
};

export default agentRoutes;
