import type { FastifyPluginAsync } from "fastify";
import { assertProjectPermission } from "../../lib/authorization.ts";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { claimChain } from "../finances/claim-chain.ts";
import { financesRepository } from "../finances/repository.ts";
import { paymentClaimsRepository } from "./repository.ts";
import {
  paymentClaimsService,
  type CreatePaymentClaimInput,
  type EditPaymentClaimInput,
} from "./service.ts";
import { PAYMENT_CLAIM_STATUSES, type RecordInvoiceInput } from "./types.ts";

const recordInvoiceBody = {
  type: "object",
  required: ["invoiceNumber"],
  additionalProperties: false,
  properties: {
    invoiceNumber: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

const claimParams = {
  type: "object",
  required: ["id", "claimId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    claimId: { type: "string", minLength: 1 },
  },
} as const;

const statusSchema = {
  type: "string",
  enum: PAYMENT_CLAIM_STATUSES,
} as const;

const createPaymentClaimBody = {
  type: "object",
  required: ["claimNumber", "amount"],
  additionalProperties: false,
  properties: {
    milestonePaymentId: { type: ["string", "null"], minLength: 1 },
    claimNumber: { type: "string", minLength: 1, maxLength: 100 },
    periodStart: { type: "string", maxLength: 30 },
    periodEnd: { type: "string", maxLength: 30 },
    amount: { type: "number", minimum: 0 },
    status: statusSchema,
    submittedAt: { type: "string", maxLength: 40 },
    approvedAt: { type: "string", maxLength: 40 },
    notes: { type: "string", maxLength: 2000 },
  },
} as const;

const editPaymentClaimBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: createPaymentClaimBody.properties,
} as const;

function requiresFinanceApproval(status: string | undefined): boolean {
  return status === "Approved" || status === "Paid";
}

const paymentClaimRoutes: FastifyPluginAsync = async (fastify) => {
  const chain = claimChain(financesRepository(fastify.db));
  const service = paymentClaimsService(paymentClaimsRepository(fastify.db), chain);

  fastify.get<{ Params: { id: string } }>(
    "/projects/:id/payment-claims",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "view");
      return service.listByProject(project.id);
    },
  );

  fastify.post<{ Params: { id: string }; Body: CreatePaymentClaimInput }>(
    "/projects/:id/payment-claims",
    { schema: { params: projectIdParams, body: createPaymentClaimBody } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: request.user!.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "view",
      );
      const user = request.requireAuth();
      if (requiresFinanceApproval(request.body.status)) {
        assertProjectPermission(
          { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
          { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
          "finances", "approve",
        );
      }
      const claim = await service.create(project.id, request.body);
      return reply.status(201).send(claim);
    },
  );

  fastify.put<{ Params: { id: string; claimId: string }; Body: EditPaymentClaimInput }>(
    "/projects/:id/payment-claims/:claimId",
    { schema: { params: claimParams, body: editPaymentClaimBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: request.user!.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "view",
      );
      const user = request.requireAuth();
      if (requiresFinanceApproval(request.body.status)) {
        assertProjectPermission(
          { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
          { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
          "finances", "approve",
        );
      }
      return service.edit(project.id, request.params.claimId, request.body);
    },
  );

  // Certification: the invoice for an approved claim is recorded, never issued
  // or charged. Same gate as approving the claim.
  fastify.post<{ Params: { id: string; claimId: string }; Body: RecordInvoiceInput }>(
    "/projects/:id/payment-claims/:claimId/record-invoice",
    { schema: { params: claimParams, body: recordInvoiceBody } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      const user = request.requireAuth();
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: user.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "approve",
      );
      return service.recordInvoice(project.id, request.params.claimId, request.body, { id: user.id, name: user.name });
    },
  );

  fastify.delete<{ Params: { id: string; claimId: string } }>(
    "/projects/:id/payment-claims/:claimId",
    { schema: { params: claimParams } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "finances", "manage");
      assertProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: request.user!.id, orgRoles: request.orgRoles, projectRoles: request.projectRoles, orgPermissions: request.orgPermissions },
        "finances",
        "view",
      );
      await service.remove(project.id, request.params.claimId);
      return reply.status(204).send();
    },
  );
};

export default paymentClaimRoutes;
