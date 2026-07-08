import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../config/index.ts";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { canProjectPermission } from "../../lib/authorization.ts";
import { generateId } from "../../lib/ids.ts";
import { saveStream } from "../../lib/file-storage.ts";
import { boqJobsRepository, dedupeBoqMaterials, type BoqJobRow } from "./boq-jobs-repository.ts";
import { BOQ_IMPORT_QUEUE, type BoqImportJobData } from "./boq-job.ts";
import { materialsEquipmentRepository } from "./repository.ts";
import { budgetRepository } from "../budget/repository.ts";
import { budgetService } from "../budget/service.ts";
import {
  materialsEquipmentService,
  type CreateEquipmentRequestInput,
  type CreateMaterialOrderInput,
  type UpdateEquipmentRequestInput,
  type UpdateMaterialOrderInput,
} from "./service.ts";
import type { EquipmentBucket, MaterialOrderStatus } from "./types.ts";

// Approval-tier statuses: moving an order/request into (or past) approval
// needs materials:approve; raising/cancelling only needs materials:request.
// materials:manage implies both, so legacy custom roles keep working.
const MATERIAL_APPROVAL_STATUSES: ReadonlySet<string> = new Set(["Approved", "Ordered", "PartiallyDelivered", "Delivered"]);
const EQUIPMENT_APPROVAL_STATUSES: ReadonlySet<string> = new Set(["Approved", "Scheduled", "OnHire", "Returned"]);

function assertMaterialsAction(
  request: FastifyRequest,
  project: { id: string; owner_id: string | null; organization_id: string | null },
  action: "request" | "approve",
): void {
  const user = request.requireAuth();
  const scope = { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id };
  const ctx = {
    userId: user.id,
    orgRoles: request.orgRoles,
    projectRoles: request.projectRoles,
    orgPermissions: request.orgPermissions,
    projectSectionPermissions: request.projectSectionPermissions,
  };
  if (canProjectPermission(scope, ctx, "materials", action)) return;
  if (canProjectPermission(scope, ctx, "materials", "manage")) return;
  throw new ForbiddenError(
    action === "approve"
      ? "Your role does not allow you to approve material or equipment requests"
      : "Your role does not allow you to raise material or equipment requests",
  );
}

const MATERIAL_STATUS = ["Draft", "Requested", "Approved", "Ordered", "PartiallyDelivered", "Delivered", "Cancelled"] as const;
const EQUIPMENT_STATUS = ["Draft", "Requested", "Approved", "Scheduled", "OnHire", "Returned", "Cancelled"] as const;
const PRIORITY = ["Low", "Normal", "High", "Critical"] as const;
const BUCKETS = ["requests", "approvals", "schedule", "on-hire", "returns"] as const;

const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const materialParams = {
  type: "object",
  required: ["id", "orderId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    orderId: { type: "string", minLength: 1 },
  },
} as const;

const equipmentParams = {
  type: "object",
  required: ["id", "requestId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    requestId: { type: "string", minLength: 1 },
  },
} as const;

const materialQuery = {
  type: "object",
  additionalProperties: false,
  properties: { status: { type: "string", enum: MATERIAL_STATUS } },
} as const;

const equipmentQuery = {
  type: "object",
  additionalProperties: false,
  properties: { bucket: { type: "string", enum: BUCKETS } },
} as const;

const materialBody = {
  type: "object",
  required: ["title", "materialName", "quantity", "unit", "neededBy"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    materialName: { type: "string", minLength: 1, maxLength: 200 },
    quantity: { type: "number", exclusiveMinimum: 0 },
    unit: { type: "string", minLength: 1, maxLength: 40 },
    supplier: { type: ["string", "null"], maxLength: 200 },
    status: { type: "string", enum: MATERIAL_STATUS },
    priority: { type: "string", enum: PRIORITY },
    phaseId: { type: ["string", "null"], maxLength: 100 },
    activityId: { type: ["string", "null"], maxLength: 100 },
    documentId: { type: ["string", "null"], maxLength: 100 },
    neededBy: { type: "string", minLength: 1, maxLength: 40 },
    orderedAt: { type: ["string", "null"], maxLength: 40 },
    expectedDeliveryAt: { type: ["string", "null"], maxLength: 40 },
    deliveredAt: { type: ["string", "null"], maxLength: 40 },
    estimatedCost: { type: "number", minimum: 0 },
    actualCost: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["NGN", "USD"] },
    deliveryLocation: { type: ["string", "null"], maxLength: 200 },
    notes: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

const materialPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: materialBody.properties,
} as const;

const equipmentBody = {
  type: "object",
  required: ["title", "equipmentName", "equipmentType", "neededFrom", "neededUntil"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    equipmentName: { type: "string", minLength: 1, maxLength: 200 },
    equipmentType: { type: "string", minLength: 1, maxLength: 120 },
    quantity: { type: "integer", minimum: 1, maximum: 500 },
    supplier: { type: ["string", "null"], maxLength: 200 },
    status: { type: "string", enum: EQUIPMENT_STATUS },
    priority: { type: "string", enum: PRIORITY },
    phaseId: { type: ["string", "null"], maxLength: 100 },
    activityId: { type: ["string", "null"], maxLength: 100 },
    documentId: { type: ["string", "null"], maxLength: 100 },
    neededFrom: { type: "string", minLength: 1, maxLength: 40 },
    neededUntil: { type: "string", minLength: 1, maxLength: 40 },
    mobilizedAt: { type: ["string", "null"], maxLength: 40 },
    returnedAt: { type: ["string", "null"], maxLength: 40 },
    estimatedCost: { type: "number", minimum: 0 },
    actualCost: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["NGN", "USD"] },
    deliveryLocation: { type: ["string", "null"], maxLength: 200 },
    operatorRequired: { type: "boolean" },
    notes: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

const equipmentPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: equipmentBody.properties,
} as const;

const bulkImportBody = {
  type: "object",
  required: ["materials"],
  additionalProperties: false,
  properties: {
    materials: {
      type: "array",
      minItems: 1,
      maxItems: 500,
      items: {
        type: "object",
        required: ["materialName", "quantity", "unit"],
        additionalProperties: false,
        properties: {
          materialName: { type: "string", minLength: 1, maxLength: 2000 },
          quantity: { type: "number", minimum: 0 },
          unit: { type: "string", minLength: 1, maxLength: 80 },
          estimatedCost: { type: "number", minimum: 0 },
          supplier: { type: ["string", "null"], maxLength: 200 },
          neededBy: { type: "string", maxLength: 40 },
          section: { type: ["string", "null"], maxLength: 200 },
        },
      },
    },
  },
} as const;

interface ImportedMaterial {
  materialName: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  supplier?: string | null;
  neededBy?: string;
  section?: string | null;
}

const materialsEquipmentRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 1 },
  });

  const service = materialsEquipmentService(materialsEquipmentRepository(fastify.db));
  const boqJobs = boqJobsRepository(fastify.db);
  const budget = budgetService(budgetRepository(fastify.db));

  function toJobDto(job: BoqJobRow) {
    const materials =
      typeof job.materials === "string"
        ? (JSON.parse(job.materials) as BoqJobRow["materials"])
        : job.materials;
    return {
      id: job.id,
      status: job.status,
      fileName: job.file_name,
      materials: job.status === "completed" ? materials : [],
      materialCount: job.material_count,
      usedAi: job.used_ai,
      error: job.error,
    };
  }

  fastify.get<{ Params: { id: string }; Querystring: { status?: MaterialOrderStatus } }>(
    "/projects/:id/materials/orders",
    { schema: { params: projectIdParams, querystring: materialQuery } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.listMaterialOrders(request.params.id, request.query.status);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateMaterialOrderInput }>(
    "/projects/:id/materials/orders",
    { schema: { params: projectIdParams, body: materialBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      assertMaterialsAction(request, project, "request");
      const user = request.requireAuth();
      return service.createMaterialOrder(request.params.id, request.body, user.id);
    },
  );

  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/materials/import",
    { schema: { params: projectIdParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      assertMaterialsAction(request, project, "request");
      const user = request.requireAuth();
      const part = await request.file();
      if (!part) throw new BadRequestError("Missing BoQ file upload");

      const stored = await saveStream(user.id, part.file);
      const job = await boqJobs.create({
        id: generateId("boq"),
        project_id: request.params.id,
        status: "pending",
        file_name: part.filename,
        storage_path: stored.storagePath,
        requested_by: user.id,
      });

      const jobData: BoqImportJobData = { jobId: job.id };
      await fastify.queue.enqueue(BOQ_IMPORT_QUEUE, "extract", jobData);

      return reply.status(202).send(toJobDto(job));
    },
  );

  fastify.get<{ Params: { id: string; jobId: string } }>(
    "/projects/:id/materials/import/:jobId",
    {
      schema: {
        params: {
          type: "object",
          required: ["id", "jobId"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            jobId: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "view");
      const job = await boqJobs.findById(request.params.jobId, request.params.id);
      if (!job) throw new NotFoundError("Import job");
      return toJobDto(job);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/materials/boq-materials",
    { schema: { params: projectIdParams } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "view");
      const rows = await boqJobs.listCompletedMaterials(request.params.id);
      return dedupeBoqMaterials(rows);
    },
  );

  fastify.post<{ Params: { id: string }; Body: { materials: ImportedMaterial[] } }>(
    "/projects/:id/materials/bulk",
    { schema: { params: projectIdParams, body: bulkImportBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      assertMaterialsAction(request, project, "request");
      const user = request.requireAuth();
      const defaultNeededBy = new Date(Date.now() + 14 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      const created = await service.bulkCreateMaterialOrders(
        request.params.id,
        request.body.materials.map((m) => {
          const name = m.materialName.trim().slice(0, 200);
          return {
            title: name,
            materialName: name,
            quantity: m.quantity,
            unit: m.unit.slice(0, 40),
            estimatedCost: m.estimatedCost ?? 0,
            supplier: m.supplier ?? null,
            neededBy: m.neededBy ?? defaultNeededBy,
            notes:
              m.materialName.length > 200
                ? `Imported from BoQ, full: ${m.materialName.trim()}`
                : "Imported from BoQ",
          };
        }),
        user.id,
      );

      const estimateItems = request.body.materials
        .map((m) => ({
          groupLabel: m.section?.trim() || "General",
          total: (m.estimatedCost ?? 0) * (m.quantity || 0),
        }))
        .filter((item) => item.total > 0);
      const budgetSeed =
        estimateItems.length > 0
          ? await budget.seedFromEstimateItems(request.params.id, estimateItems, "skip")
          : { created: 0, skipped: 0 };

      return reply.status(201).send({ created, budgetCategories: budgetSeed });
    },
  );

  fastify.patch<{ Params: { id: string; orderId: string }; Body: UpdateMaterialOrderInput }>(
    "/projects/:id/materials/orders/:orderId",
    { schema: { params: materialParams, body: materialPatchBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      const needsApprove = request.body.status !== undefined && MATERIAL_APPROVAL_STATUSES.has(request.body.status);
      assertMaterialsAction(request, project, needsApprove ? "approve" : "request");
      return service.updateMaterialOrder(request.params.id, request.params.orderId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; orderId: string } }>(
    "/projects/:id/materials/orders/:orderId",
    { schema: { params: materialParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      assertMaterialsAction(request, project, "approve");
      await service.deleteMaterialOrder(request.params.id, request.params.orderId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string }; Querystring: { bucket?: EquipmentBucket } }>(
    "/projects/:id/equipment-requests",
    { schema: { params: projectIdParams, querystring: equipmentQuery } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.listEquipmentRequests(request.params.id, request.query.bucket);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateEquipmentRequestInput }>(
    "/projects/:id/equipment-requests",
    { schema: { params: projectIdParams, body: equipmentBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      assertMaterialsAction(request, project, "request");
      const user = request.requireAuth();
      return service.createEquipmentRequest(request.params.id, request.body, user.id);
    },
  );

  fastify.patch<{ Params: { id: string; requestId: string }; Body: UpdateEquipmentRequestInput }>(
    "/projects/:id/equipment-requests/:requestId",
    { schema: { params: equipmentParams, body: equipmentPatchBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      const needsApprove = request.body.status !== undefined && EQUIPMENT_APPROVAL_STATUSES.has(request.body.status);
      assertMaterialsAction(request, project, needsApprove ? "approve" : "request");
      return service.updateEquipmentRequest(request.params.id, request.params.requestId, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; requestId: string } }>(
    "/projects/:id/equipment-requests/:requestId",
    { schema: { params: equipmentParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      assertMaterialsAction(request, project, "approve");
      await service.deleteEquipmentRequest(request.params.id, request.params.requestId);
      return reply.status(204).send();
    },
  );
};

export default materialsEquipmentRoutes;
