import type { FastifyPluginAsync } from "fastify";
import { getDownloadUrl } from "../../lib/file-storage.ts";
import { filesRepository } from "../files/repository.ts";
import { complianceDocsRepository } from "./repository.ts";
import { complianceDocsService } from "./service.ts";
import { COMPLIANCE_DOC_TYPES } from "./types.ts";
import type { CreateComplianceDocInput, UpdateComplianceDocInput } from "./types.ts";

const docParams = {
  type: "object",
  required: ["docId"],
  additionalProperties: false,
  properties: { docId: { type: "string", minLength: 1 } },
} as const;

const dateOrNull = { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" } as const;

const createBody = {
  type: "object",
  required: ["fileId", "docType"],
  additionalProperties: false,
  properties: {
    fileId: { type: "string", minLength: 1 },
    docType: { type: "string", enum: COMPLIANCE_DOC_TYPES },
    reference: { type: ["string", "null"], maxLength: 120 },
    notes: { type: ["string", "null"], maxLength: 1000 },
    expiryDate: dateOrNull,
  },
} as const;

const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    docType: { type: "string", enum: COMPLIANCE_DOC_TYPES },
    reference: { type: ["string", "null"], maxLength: 120 },
    notes: { type: ["string", "null"], maxLength: 1000 },
    expiryDate: dateOrNull,
  },
} as const;

const complianceDocsRoutes: FastifyPluginAsync = async (fastify) => {
  const files = filesRepository(fastify.db);
  const service = complianceDocsService(complianceDocsRepository(fastify.db), (id) => files.findById(id));

  fastify.get("/org/compliance-docs", async (request) => {
    request.requireAuth();
    const orgId = request.requireOrgPermission("complianceDocs", "view");
    return service.list(orgId);
  });

  fastify.post<{ Body: CreateComplianceDocInput }>(
    "/org/compliance-docs",
    { schema: { body: createBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("complianceDocs", "manage");
      const doc = await service.create(orgId, user.id, request.body);
      return reply.status(201).send(doc);
    },
  );

  fastify.patch<{ Params: { docId: string }; Body: UpdateComplianceDocInput }>(
    "/org/compliance-docs/:docId",
    { schema: { params: docParams, body: updateBody } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("complianceDocs", "manage");
      return service.update(orgId, request.params.docId, request.body);
    },
  );

  fastify.delete<{ Params: { docId: string } }>(
    "/org/compliance-docs/:docId",
    { schema: { params: docParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("complianceDocs", "manage");
      return service.remove(orgId, request.params.docId);
    },
  );

  fastify.get<{ Params: { docId: string } }>(
    "/org/compliance-docs/:docId/url",
    { schema: { params: docParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("complianceDocs", "view");
      const { storagePath } = await service.storagePathFor(orgId, request.params.docId);
      return { url: await getDownloadUrl(storagePath) };
    },
  );
};

export default complianceDocsRoutes;
