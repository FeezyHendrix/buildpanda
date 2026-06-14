import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../../config/index.ts";
import { BadRequestError } from "../../../lib/errors.ts";
import { generateId } from "../../../lib/ids.ts";
import { saveStream } from "../../../lib/file-storage.ts";
import { currencyCodeSchema, resolveCurrency } from "../../../lib/currencies.ts";
import { getOrgDefaultCurrency } from "../../../lib/org-currency-cache.ts";
import { attachImportedDocument } from "../../../lib/project-documents.ts";
import { programmeJobsRepository, type ProgrammeJobRow } from "./jobs-repository.ts";
import { PROGRAMME_IMPORT_QUEUE, type ProgrammeImportJobData } from "./job.ts";
import { applyProgramme } from "./apply.ts";
import type { StructuredProgramme } from "./structure.ts";

const jobIdParams = {
  type: "object",
  required: ["jobId"],
  properties: { jobId: { type: "string" } },
  additionalProperties: false,
} as const;

const applyBody = {
  type: "object",
  required: ["city", "state", "budgetTotal"],
  properties: {
    projectName: { type: "string", minLength: 1, maxLength: 200 },
    city: { type: "string", minLength: 1, maxLength: 120 },
    state: { type: "string", minLength: 1, maxLength: 120 },
    budgetTotal: { type: "number", minimum: 0 },
    currency: currencyCodeSchema,
  },
  additionalProperties: false,
} as const;

interface ApplyRequestBody {
  projectName?: string;
  city: string;
  state: string;
  budgetTotal: number;
  currency?: string;
}

function parseResult(job: ProgrammeJobRow): StructuredProgramme | null {
  if (job.status !== "completed" && job.status !== "applied") return null;
  return typeof job.result === "string"
    ? (JSON.parse(job.result) as StructuredProgramme)
    : job.result;
}

const programmeImportRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 1 },
  });

  const jobs = programmeJobsRepository(fastify.db);

  function toJobDto(job: ProgrammeJobRow) {
    return {
      id: job.id,
      status: job.status,
      fileName: job.file_name,
      activityCount: job.activity_count,
      phaseCount: job.phase_count,
      usedAi: job.used_ai,
      createdProjectId: job.created_project_id,
      error: job.error,
      result: parseResult(job),
    };
  }

  fastify.post(
    "/projects/import/programme",
    async (request, reply) => {
      const user = request.requireAuth();
      const activeOrg = request.activeOrganizationId;
      const organizationId =
        activeOrg !== null && request.orgRoles.has(activeOrg) ? activeOrg : null;
      if (organizationId !== null) {
        request.requireOrgPermission("project", "create");
      }

      const part = await request.file();
      if (!part) throw new BadRequestError("Missing programme file upload");
      if (!/\.(mpp|xml|xls|xlsx)$/i.test(part.filename)) {
        throw new BadRequestError("Programme file must be .mpp, .xml, .xls or .xlsx");
      }

      const stored = await saveStream(user.id, part.file);
      const job = await jobs.create({
        id: generateId("pgm"),
        organization_id: organizationId,
        status: "pending",
        file_name: part.filename,
        storage_path: stored.storagePath,
        requested_by: user.id,
      });

      const jobData: ProgrammeImportJobData = { jobId: job.id };
      await fastify.queue.enqueue(PROGRAMME_IMPORT_QUEUE, "extract", jobData);

      return reply.status(202).send(toJobDto(job));
    },
  );

  fastify.get<{ Params: { jobId: string } }>(
    "/projects/import/programme/:jobId",
    { schema: { params: jobIdParams } },
    async (request) => {
      const user = request.requireAuth();
      const job = await jobs.findByIdForUser(request.params.jobId, user.id);
      if (!job) throw new BadRequestError("Programme import job not found");
      return toJobDto(job);
    },
  );

  fastify.post<{ Params: { jobId: string }; Body: ApplyRequestBody }>(
    "/projects/import/programme/:jobId/apply",
    { schema: { params: jobIdParams, body: applyBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const activeOrg = request.activeOrganizationId;
      const organizationId =
        activeOrg !== null && request.orgRoles.has(activeOrg) ? activeOrg : null;
      if (organizationId !== null) {
        request.requireOrgPermission("project", "create");
      }

      const job = await jobs.findByIdForUser(request.params.jobId, user.id);
      if (!job) throw new BadRequestError("Programme import job not found");
      if (job.status === "applied") {
        throw new BadRequestError("This programme has already been applied");
      }
      if (job.status !== "completed") {
        throw new BadRequestError("Programme import is not ready to apply");
      }

      const programme = parseResult(job);
      if (!programme || programme.activities.length === 0) {
        throw new BadRequestError("Programme contains no activities to import");
      }

      const body = request.body;
      const orgDefault = organizationId
        ? await getOrgDefaultCurrency(fastify.db, organizationId)
        : null;
      const resolvedCurrency = resolveCurrency(body.currency, orgDefault);

      const result = await applyProgramme(fastify.db, programme, {
        organizationId,
        ownerId: user.id,
        currency: resolvedCurrency,
        city: body.city,
        state: body.state,
        budgetTotal: body.budgetTotal,
        projectName: body.projectName,
      });

      await jobs.markApplied(job.id, result.projectId);

      await attachImportedDocument(fastify.db, {
        projectId: result.projectId,
        ownerId: user.id,
        fileName: job.file_name,
        storagePath: job.storage_path,
        categoryName: "Schedules & Programmes",
      }).catch(() => undefined);

      return reply.status(201).send(result);
    },
  );
};

export default programmeImportRoutes;
