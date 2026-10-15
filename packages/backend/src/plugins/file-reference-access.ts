import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { requireProjectFileReferences } from "../modules/files/attachment-access.ts";
import { filesRepository } from "../modules/files/repository.ts";
import { fileAccessRepository } from "../modules/files/access-repository.ts";

/** All project record writers share the same attachment boundary. */
const fileReferenceAccess: FastifyPluginAsync = async (app) => {
  const files = filesRepository(app.db);
  const access = fileAccessRepository(app.db);
  app.addHook("preHandler", async (request) => {
    if (!["POST", "PATCH", "PUT"].includes(request.method)) return;
    const route = request.routeOptions.url ?? '';
    // These handlers resolve their own conversation/share-link scope and run
    // the same reference check after authorizing that destination.
    if (route.startsWith('/channels/:id') || route.startsWith('/messages/:id') || route === '/proposals/public/:token/respond') return;
    const segments = route.split('/');
    const projectId = segments[1] === "projects" && segments[2]?.startsWith(":")
      ? (request.params as Record<string, string>)[segments[2].slice(1)] : undefined;
    await requireProjectFileReferences(request, projectId, files, access);
  });
};

export default fp(fileReferenceAccess, { name: "file-reference-access", dependencies: ["auth-context"] });
