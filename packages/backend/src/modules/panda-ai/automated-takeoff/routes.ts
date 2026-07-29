import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import { saveStream } from "../../../lib/file-storage.ts";
import { generateId } from "../../../lib/ids.ts";
import { config } from "../../../config/index.ts";
import { takeoffJobsRepository } from "./jobs-repository.ts";
import { TAKEOFF_QUEUE, type TakeoffJobData } from "./job.ts";
import type { TakeoffJob, TakeoffJobRow, TakeoffResult } from "./types.ts";

function toDto(job: TakeoffJobRow): TakeoffJob {
  const result =
    job.result === null
      ? null
      : typeof job.result === "string"
        ? (JSON.parse(job.result) as TakeoffResult)
        : job.result;
  return {
    id: job.id,
    projectId: job.project_id,
    proposalId: job.proposal_id,
    fileId: job.file_id,
    status: job.status,
    fileName: job.file_name,
    result,
    drawingCount: job.drawing_count,
    elementCount: job.element_count,
    error: job.error,
    createdAt: new Date(job.created_at).toISOString(),
    updatedAt: new Date(job.updated_at).toISOString(),
  };
}

const idParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const jobParams = {
  type: "object",
  required: ["id", "jobId"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 }, jobId: { type: "string", minLength: 1 } },
} as const;

const proposalPlanParams = {
  type: "object",
  required: ["id", "planId"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 }, planId: { type: "string", minLength: 1 } },
} as const;

const automatedTakeoffRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 1 },
  });

  const jobs = takeoffJobsRepository(fastify.db);

  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/ai/takeoff",
    { schema: { params: idParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      const user = request.requireAuth();
      const part = await request.file();
      if (!part) throw new BadRequestError("No file uploaded");
      if (!/\.dwg$/i.test(part.filename)) {
        throw new BadRequestError("Automated take-off expects a DWG file (.dwg)");
      }
      const stored = await saveStream(user.id, part.file);
      const job = await jobs.create({
        id: generateId("tko"),
        project_id: project.id,
        proposal_id: null,
        file_id: null,
        status: "pending",
        file_name: part.filename,
        storage_path: stored.storagePath,
        requested_by: user.id,
      });
      const jobData: TakeoffJobData = {
        jobId: job.id,
        orgId: project.organization_id ?? undefined,
      };
      await fastify.queue.enqueue(TAKEOFF_QUEUE, "takeoff", jobData);
      return reply.status(202).send(toDto(job));
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/ai/takeoff",
    { schema: { params: idParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");
      const rows = await jobs.listByProject(project.id);
      return rows.map(toDto);
    },
  );

  fastify.get<{ Params: { id: string; jobId: string } }>(
    "/projects/:id/ai/takeoff/:jobId",
    { schema: { params: jobParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");
      const job = await jobs.findById(request.params.jobId, project.id);
      if (!job) throw new NotFoundError("Take-off job");
      return toDto(job);
    },
  );

  fastify.post<{ Params: { id: string; planId: string } }>(
    "/proposals/:id/plans/:planId/automated-takeoff",
    { schema: { params: proposalPlanParams } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const user = request.requireAuth();
      const proposal = await fastify.db("proposals")
        .where({ id: request.params.id, org_id: orgId })
        .first<{ id: string }>();
      if (!proposal) throw new NotFoundError("Proposal");

      const plan = await fastify.db("proposal_plans as pp")
        .join("uploaded_files as f", "f.id", "pp.file_id")
        .where({ "pp.id": request.params.planId, "pp.proposal_id": request.params.id })
        .select<{
          file_id: string;
          file_name: string;
          storage_path: string;
        }[]>("f.id as file_id", "f.file_name", "f.storage_path")
        .first();
      if (!plan) throw new NotFoundError("Plan");
      if (!/\.dwg$/i.test(plan.file_name)) {
        throw new BadRequestError("Automated take-off expects a DWG plan (.dwg)");
      }

      const job = await jobs.create({
        id: generateId("tko"),
        project_id: null,
        proposal_id: request.params.id,
        file_id: plan.file_id,
        status: "pending",
        file_name: plan.file_name,
        storage_path: plan.storage_path,
        requested_by: user.id,
      });
      await fastify.queue.enqueue(TAKEOFF_QUEUE, "takeoff", { jobId: job.id, orgId } satisfies TakeoffJobData);
      return reply.status(202).send(toDto(job));
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id/automated-takeoff",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgScope();
      const proposal = await fastify.db("proposals")
        .where({ id: request.params.id, org_id: orgId })
        .first<{ id: string }>();
      if (!proposal) throw new NotFoundError("Proposal");
      const rows = await jobs.listByProposal(request.params.id);
      return rows.map(toDto);
    },
  );

  fastify.get<{ Params: { id: string; jobId: string } }>(
    "/proposals/:id/automated-takeoff/:jobId",
    { schema: { params: jobParams } },
    async (request) => {
      const orgId = request.requireOrgScope();
      const proposal = await fastify.db("proposals")
        .where({ id: request.params.id, org_id: orgId })
        .first<{ id: string }>();
      if (!proposal) throw new NotFoundError("Proposal");
      const job = await jobs.findByIdForProposal(request.params.jobId, request.params.id);
      if (!job) throw new NotFoundError("Take-off job");
      return toDto(job);
    },
  );
};

export default automatedTakeoffRoutes;
