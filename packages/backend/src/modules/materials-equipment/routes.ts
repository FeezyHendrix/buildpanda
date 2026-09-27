import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { config } from "../../config/index.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { saveStream } from "../../lib/file-storage.ts";
import { boqJobsRepository, dedupeBoqMaterials, type BoqJobRow } from "./boq-jobs-repository.ts";
import { BOQ_IMPORT_QUEUE, type BoqImportJobData } from "./boq-job.ts";
import { budgetRepository } from "../budget/repository.ts";
import { budgetService } from "../budget/service.ts";
import deliveryRoutes from "./delivery-routes.ts";
import equipmentRoutes from "./equipment-routes.ts";
import { MATERIAL_APPROVAL_STATUSES, assertMaterialsAction } from "./permissions.ts";
import {
  bulkImportBody,
  importJobParams,
  materialBody,
  materialOrderResponse,
  materialParams,
  materialPatchBody,
  materialQuery,
  projectIdParams,
} from "./schemas.ts";
import { buildMaterialsServices } from "./wiring.ts";
import type {
  CreateMaterialOrderInput,
  ImportedMaterial,
  MaterialOrderStatus,
  UpdateMaterialOrderInput,
} from "./types.ts";

const materialsEquipmentRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 1 },
  });

  const { service } = buildMaterialsServices(fastify);
  const boqJobs = boqJobsRepository(fastify.db);
  const budget = budgetService(budgetRepository(fastify.db));

  await fastify.register(equipmentRoutes);
  await fastify.register(deliveryRoutes);

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

  fastify.get<{ Params: { id: string }; Querystring: { status?: MaterialOrderStatus; late?: boolean } }>(
    "/projects/:id/materials/orders",
    {
      schema: {
        params: projectIdParams,
        querystring: materialQuery,
        response: { 200: { type: "array", items: materialOrderResponse } },
      },
    },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "view");
      if (request.query.late) return service.listLateMaterialOrders(request.params.id);
      return service.listMaterialOrders(request.params.id, request.query.status);
    },
  );

  fastify.get<{ Params: { id: string; orderId: string } }>(
    "/projects/:id/materials/orders/:orderId",
    { schema: { params: materialParams, response: { 200: materialOrderResponse } } },
    async (request) => {
      await request.requireProjectPermission(request.params.id, "materials", "view");
      return service.getMaterialOrder(request.params.id, request.params.orderId);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreateMaterialOrderInput }>(
    "/projects/:id/materials/orders",
    { schema: { params: projectIdParams, body: materialBody, response: { 200: materialOrderResponse } } },
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

      const jobData: BoqImportJobData = { jobId: job.id, orgId: project.organization_id ?? undefined };
      await fastify.queue.enqueue(BOQ_IMPORT_QUEUE, "extract", jobData);

      return reply.status(202).send(toJobDto(job));
    },
  );

  fastify.get<{ Params: { id: string; jobId: string } }>(
    "/projects/:id/materials/import/:jobId",
    { schema: { params: importJobParams } },
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
    { schema: { params: materialParams, body: materialPatchBody, response: { 200: materialOrderResponse } } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "materials", "request");
      const needsApprove =
        request.body.status !== undefined && MATERIAL_APPROVAL_STATUSES.has(request.body.status);
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
};

export default materialsEquipmentRoutes;
