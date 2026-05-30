import type { FastifyPluginAsync } from "fastify";
import { assertCanModify } from "../../lib/authorization.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { filesRepository } from "../files/repository.ts";
import { projectsRepository } from "../projects/repository.ts";
import { documentsRepository } from "./repository.ts";
import { documentsService, type CreateDocumentInput } from "./service.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const createDocumentBody = {
  type: "object",
  required: ["categoryId"],
  additionalProperties: false,
  properties: {
    categoryId: { type: "string", minLength: 1, maxLength: 100 },
    fileId: { type: "string", minLength: 1, maxLength: 100 },
    fileName: { type: "string", minLength: 1, maxLength: 255 },
    size: { type: "string", minLength: 1, maxLength: 50 },
    uploadedAt: { type: "string", minLength: 1, maxLength: 100 },
    status: { type: "string", enum: ["Verified", "Pending", "Expired"] },
  },
} as const;

const documentRoutes: FastifyPluginAsync = async (fastify) => {
  const projects = projectsRepository(fastify.db);
  const service = documentsService(
    documentsRepository(fastify.db),
    filesRepository(fastify.db),
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/documents",
    { schema: { params: projectIdParams } },
    async (request) => {
      request.requireAuth();
      return service.listByProject(request.params.id);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/documents/categories",
    { schema: { params: projectIdParams } },
    async (request) => {
      request.requireAuth();
      return service.categoriesForProject(request.params.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateDocumentInput }>(
    "/projects/:id/documents",
    { schema: { params: projectIdParams, body: createDocumentBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const project = await projects.findById(request.params.id);
      if (!project) throw new NotFoundError("Project");
      assertCanModify({ ownerId: project.owner_id }, user);

      const doc = await service.create(project.id, request.body, user.id);
      return reply.status(201).send(doc);
    },
  );
};

export default documentRoutes;
