import type { FastifyPluginAsync } from "fastify";
import { sendEmail } from "../../lib/mail.ts";
import {
  consultationLeadEmail,
  type ConsultationLead,
} from "../../lib/email-templates.ts";
import { config } from "../../config/index.ts";
import { leadsRepository } from "./repository.ts";
import { leadsService } from "./service.ts";
import { LEAD_STATUSES } from "./types.ts";
import { ForbiddenError, NotFoundError } from "../../lib/errors.ts";

const consultationBody = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    // ajv-formats isn't registered — use pattern instead of format: "email"
    email: { type: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", maxLength: 320 },
    phone: { type: "string", minLength: 1, maxLength: 50 },
    location: { type: "string", minLength: 1, maxLength: 200 },
    projectType: { type: "string", minLength: 1, maxLength: 100 },
    message: { type: "string", maxLength: 5000 },
    source: { type: "string", maxLength: 100 },
  },
  required: ["name", "email", "phone", "location", "projectType"],
  additionalProperties: false,
} as const;

const idParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: LEAD_STATUSES },
    limit: { type: "integer", minimum: 1, maximum: 100 },
    offset: { type: "integer", minimum: 0 },
  },
} as const;

const patchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    status: { type: "string", enum: LEAD_STATUSES },
    notes: { type: "string", maxLength: 5000 },
  },
} as const;

/**
 * Public + org-scoped lead endpoints.
 * POST /leads/consultation  — public marketing form, persists as org_id=null
 * GET  /leads               — company's own leads (requires auth + active org)
 * PATCH /leads/:id          — update status/notes for a company's lead
 */
const leadRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = leadsRepository(fastify.db);
  const service = leadsService(repo);

  fastify.post<{ Body: ConsultationLead }>(
    "/leads/consultation",
    { schema: { body: consultationBody } },
    async (request, reply) => {
      const body = request.body;
      const lead = await service.createLead({
        name: body.name,
        email: body.email,
        phone: body.phone,
        location: body.location,
        projectType: body.projectType,
        message: body.message,
        source: body.source ?? "website",
        orgId: null, // platform lead — admin assigns to an org later
      });

      const { subject, html } = consultationLeadEmail(body);
      await sendEmail({
        to: config.mail.leadsNotifyAddresses,
        toName: "BuildPanda Team",
        subject,
        html,
      });
      request.log.info(
        { leadId: lead.id, email: body.email, projectType: body.projectType },
        "Consultation lead received",
      );
      return reply.status(201).send({ received: true });
    },
  );

  fastify.get<{ Querystring: { status?: string; limit?: number; offset?: number } }>(
    "/leads",
    { schema: { querystring: listQuery } },
    async (request) => {
      request.requireAuth();
      const orgId = request.activeOrganizationId;
      if (!orgId || !request.orgRoles.has(orgId)) {
        throw new ForbiddenError("No active organization");
      }
      return service.listForOrg(orgId, {
        status: request.query.status,
        limit: request.query.limit ?? 25,
        offset: request.query.offset ?? 0,
      });
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { status?: string; notes?: string } }>(
    "/leads/:id",
    { schema: { params: idParams, body: patchBody } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.activeOrganizationId;
      if (!orgId || !request.orgRoles.has(orgId)) {
        throw new ForbiddenError("No active organization");
      }
      const { id } = request.params;
      const { status, notes } = request.body;

      let lead = await repo.getById(id);
      if (!lead || lead.orgId !== orgId) throw new NotFoundError("Lead");

      if (status) {
        lead = await service.updateStatus(id, orgId, status as typeof LEAD_STATUSES[number]) ?? lead;
      }
      if (notes !== undefined) {
        lead = await service.updateNotes(id, orgId, notes) ?? lead;
      }
      return reply.send(lead);
    },
  );
};

export default leadRoutes;
