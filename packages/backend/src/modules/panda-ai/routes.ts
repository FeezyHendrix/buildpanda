import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../config/index.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { saveStream } from "../../lib/file-storage.ts";
import { pandaAiRepository } from "./repository.ts";
import { pandaAiService } from "./service.ts";
import { detectPhases } from "./phase-detection.ts";
import { materialsEquipmentRepository } from "../materials-equipment/repository.ts";
import { materialsEquipmentService } from "../materials-equipment/service.ts";
import {
  projectFileJobsRepository,
  parseExtraction,
} from "./project-file-jobs-repository.ts";
import {
  PROJECT_FILE_IMPORT_QUEUE,
  type ProjectFileImportJobData,
} from "./project-file-job.ts";
import { applyExtraction, type ApplyExtractionSelection } from "./project-file-apply.ts";

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const jobIdParams = {
  type: "object",
  required: ["jobId"],
  additionalProperties: false,
  properties: { jobId: { type: "string", minLength: 1 } },
} as const;

const applyBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    projectId: { type: "string", minLength: 1 },
    selection: {
      type: "object",
      additionalProperties: false,
      properties: {
        metadata: { type: "boolean" },
        timeline: { type: "boolean" },
        budget: { type: "boolean" },
        materials: { type: "boolean" },
      },
    },
  },
} as const;

function jobToDto(row: NonNullable<Awaited<ReturnType<ReturnType<typeof projectFileJobsRepository>["rawById"]>>>) {
  return {
    id: row.id,
    status: row.status,
    fileName: row.file_name,
    projectId: row.project_id,
    error: row.error,
    extraction: parseExtraction(row.extraction),
  };
}

const pandaAiRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 1 },
  });

  const service = pandaAiService(pandaAiRepository(fastify.db), fastify.queue);
  const materials = materialsEquipmentService(materialsEquipmentRepository(fastify.db));
  const projectFileJobs = projectFileJobsRepository(fastify.db);

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/ai/insights",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");
      return { insight: await service.getLatest(project.id) };
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/ai/analyze",
    { schema: { params: projectIdParams } },
    async (request, reply) => {
      const project = await request.requireProjectWrite(request.params.id);
      const user = request.requireAuth();
      const insight = await service.trigger(project.id, user.id, project.organization_id ?? undefined);
      return reply.status(202).send({ insight });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/ai/detect-phases",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");
      const orders = await materials.listMaterialOrders(request.params.id);
      const materialNames = orders.map((order) => order.materialName).filter(Boolean);
      return detectPhases(project.name, materialNames);
    },
  );

  fastify.post<{ Querystring: { sessionId?: string } }>(
    "/project-files/extract",
    async (request, reply) => {
      const user = request.requireAuth();
      const part = await request.file();
      if (!part) throw new BadRequestError("Missing project file upload");
      const stored = await saveStream(user.id, part.file);
      const job = await projectFileJobs.create({
        id: generateId("pfj"),
        session_id: request.query.sessionId ?? null,
        file_name: part.filename,
        storage_path: stored.storagePath,
        requested_by: user.id,
      });
      const jobData: ProjectFileImportJobData = { jobId: job.id };
      await fastify.queue.enqueue(PROJECT_FILE_IMPORT_QUEUE, "extract", jobData);
      return reply.status(202).send(jobToDto(job));
    },
  );

  fastify.get<{ Params: { jobId: string } }>(
    "/project-files/extract/:jobId",
    { schema: { params: jobIdParams } },
    async (request) => {
      request.requireAuth();
      const job = await projectFileJobs.rawById(request.params.jobId);
      if (!job) throw new NotFoundError("Project file import job");
      return jobToDto(job);
    },
  );

  fastify.post<{
    Params: { jobId: string };
    Body: { projectId?: string; selection?: ApplyExtractionSelection };
  }>(
    "/project-files/extract/:jobId/apply",
    { schema: { params: jobIdParams, body: applyBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const job = await projectFileJobs.rawById(request.params.jobId);
      if (!job) throw new NotFoundError("Project file import job");
      const extraction = parseExtraction(job.extraction);
      if (!extraction) throw new BadRequestError("Extraction is not ready yet");

      if (request.body.projectId) {
        await request.requireProjectWrite(request.body.projectId);
      }

      const result = await applyExtraction(fastify.db, extraction, user.id, {
        projectId: request.body.projectId,
        organizationId: request.activeOrganizationId,
        selection: request.body.selection,
      });
      await projectFileJobs.markApplied(job.id, result.projectId);
      return reply.status(201).send(result);
    },
  );
};

export default pandaAiRoutes;
