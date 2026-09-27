import * as XLSX from "xlsx";
import type { FastifyPluginAsync } from "fastify";
import { estimateItemsService } from "./estimate-items-service.ts";
import { proposalsRepository } from "./repository.ts";
import { proposalsService } from "./service.ts";
import planRoutes from "./plan-routes.ts";
import { JOB_PROFILES, PROPOSAL_STATUSES } from "./types.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { idParams, paginationProperties } from "../../lib/schemas.ts";
import type { CreateProposalInput } from "./types.ts";

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: PROPOSAL_STATUSES },
    ...paginationProperties,
  },
} as const;

const createProposalBody = {
  type: "object",
  required: ["title", "clientName"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    clientName: { type: "string", minLength: 1, maxLength: 200 },
    clientEmail: { type: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", maxLength: 320 },
    clientPhone: { type: "string", maxLength: 50 },
    location: { type: "string", maxLength: 200 },
    brief: { type: "string", maxLength: 5000 },
    currency: { type: "string", maxLength: 10 },
    validUntil: { type: "string", maxLength: 30 },
    leadId: { type: "string", maxLength: 100 },
    jobProfile: { type: "string", enum: JOB_PROFILES },
  },
} as const;

const patchProposalBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    clientName: { type: "string", minLength: 1, maxLength: 200 },
    clientEmail: { type: ["string", "null"], maxLength: 320 },
    clientPhone: { type: ["string", "null"], maxLength: 50 },
    location: { type: ["string", "null"], maxLength: 200 },
    brief: { type: ["string", "null"], maxLength: 5000 },
    status: { type: "string", enum: PROPOSAL_STATUSES },
    currency: { type: "string", maxLength: 10 },
    validUntil: { type: ["string", "null"], maxLength: 30 },
    jobProfile: { type: "string", enum: JOB_PROFILES },
  },
} as const;

const proposalRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = proposalsRepository(fastify.db);
  const estimates = estimateItemsService(fastify.db);
  const service = proposalsService(repo, estimates);

  // --- Proposals ---

  fastify.get<{ Querystring: { status?: string; limit?: number; offset?: number } }>(
    "/proposals",
    { schema: { querystring: listQuery } },
    async (request) => {
      const orgId = request.requireOrgScope();
      return repo.listByOrg(orgId, {
        status: request.query.status,
        limit: request.query.limit ?? 25,
        offset: request.query.offset ?? 0,
      });
    },
  );

  fastify.post<{ Body: CreateProposalInput }>(
    "/proposals",
    { schema: { body: createProposalBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "create");
      const user = request.requireAuth();
      const proposal = await service.createProposal(orgId, user.id, request.body);
      return reply.status(201).send(proposal);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgScope();
      const workspace = await service.getWorkspace(request.params.id, orgId);
      if (!workspace) throw new NotFoundError("Proposal");
      return workspace;
    },
  );

  fastify.patch<{ Params: { id: string }; Body: Partial<CreateProposalInput & { status: string; validUntil: string | null }> }>(
    "/proposals/:id",
    { schema: { params: idParams, body: patchProposalBody } },
    async (request) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const { id } = request.params;
      const updated = await repo.updateProposal(id, orgId, {
        title: request.body.title,
        clientName: request.body.clientName,
        clientEmail: request.body.clientEmail as string | null | undefined,
        clientPhone: request.body.clientPhone as string | null | undefined,
        location: request.body.location as string | null | undefined,
        brief: request.body.brief as string | null | undefined,
        status: request.body.status as import("./types.ts").ProposalStatus | undefined,
        currency: request.body.currency,
        validUntil: (request.body as { validUntil?: string | null }).validUntil,
        jobProfile: request.body.jobProfile,
      });
      if (!updated) throw new NotFoundError("Proposal");
      return repo.toProposal(updated);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    "/proposals/:id",
    { schema: { params: idParams } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("proposals", "delete");
      await repo.deleteProposal(request.params.id, orgId);
      return reply.status(204).send();
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id/events",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgScope();
      const exists = await repo.getById(request.params.id, orgId);
      if (!exists) throw new NotFoundError("Proposal");
      return repo.listEvents(request.params.id);
    },
  );

  await fastify.register(planRoutes);

  // --- BoQ items ---

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id/boq",
    { schema: { params: idParams } },
    async (request) => {
      const orgId = request.requireOrgScope();
      const exists = await repo.getById(request.params.id, orgId);
      if (!exists) throw new NotFoundError("Proposal");
      return repo.listBoqItems(request.params.id);
    },
  );

  fastify.put<{
    Params: { id: string };
    Body: Array<{
      groupLabel: string;
      description: string;
      qty: number;
      unit: string;
      sort?: number;
    }>;
  }>(
    "/proposals/:id/boq",
    {
      schema: {
        params: idParams,
        body: {
          type: "array",
          items: {
            type: "object",
            required: ["groupLabel", "description", "qty", "unit"],
            additionalProperties: false,
            properties: {
              groupLabel: { type: "string", minLength: 1, maxLength: 100 },
              description: { type: "string", minLength: 1, maxLength: 500 },
              descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
              qty: { type: "number", minimum: 0 },
              unit: { type: "string", minLength: 1, maxLength: 50 },
              sort: { type: "integer", minimum: 0 },
            },
          },
        } as const,
      },
    },
    async (request) => {
      const orgId = request.requireOrgPermission("proposals", "update");
      const exists = await repo.getById(request.params.id, orgId);
      if (!exists) throw new NotFoundError("Proposal");
      await repo.replaceBoqItems(request.params.id, request.body);
      return repo.listBoqItems(request.params.id);
    },
  );

  fastify.get<{ Params: { id: string } }>(
    "/proposals/:id/boq/export",
    { schema: { params: idParams } },
    async (request, reply) => {
      const orgId = request.requireOrgScope();
      const proposal = await repo.getById(request.params.id, orgId);
      if (!proposal) throw new NotFoundError("Proposal");
      const items = await repo.listBoqItems(request.params.id);

      const rows: Array<Array<string | number | null>> = [
        [`BILL OF QUANTITIES — ${proposal.title}`],
        [`Client: ${proposal.client_name}`, "", "", `Currency: ${proposal.currency}`],
        [`Location: ${proposal.location ?? "To be confirmed"}`],
        [],
        ["S/N", "DESCRIPTION OF ITEM", "QTY", "UNIT"],
      ];

      let currentGroup = "";
      let sn = 0;
      for (const item of items) {
        if (item.groupLabel !== currentGroup) {
          currentGroup = item.groupLabel;
          rows.push([], [currentGroup.toUpperCase()]);
        }
        rows.push([
          String.fromCharCode(65 + (sn % 26)),
          item.description,
          item.qty,
          item.unit,
        ]);
        sn += 1;
      }
      rows.push([], ["", "NOTE: Quantities are draft take-offs and must be reviewed by a quantity surveyor."]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 6 }, { wch: 72 }, { wch: 12 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "BoQ");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;

      reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      reply.header("Content-Disposition", `attachment; filename="${proposal.number}_boq.xlsx"`);
      return reply.send(buffer);
    },
  );
};

export default proposalRoutes;
