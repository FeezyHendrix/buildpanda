import type { FastifyPluginAsync } from "fastify";
import { sendEmail } from "../../lib/mail.ts";
import {
  consultationLeadEmail,
  type ConsultationLead,
} from "../../lib/email-templates.ts";
import { websiteQuestionEmail } from "../../lib/website-question-email.ts";
import { config } from "../../config/index.ts";
import { leadsRepository } from "./repository.ts";
import { cleanPublicQuestion, leadsService, type PublicQuestion } from "./service.ts";
import { LEAD_STATUSES } from "./types.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { idParams, paginationProperties } from "../../lib/schemas.ts";
import { leadsRateLimit, questionRateLimit } from "../../plugins/security.ts";

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

const questionBody = {
  type: "object",
  properties: {
    // ASCII-only, no quotes or angle brackets: the address is echoed into a
    // mailto link and the team's inbox, so it gets no room to carry markup.
    email: { type: "string", pattern: "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,24}$", maxLength: 254 },
    question: { type: "string", minLength: 3, maxLength: 2000 },
    name: { type: "string", maxLength: 120 },
    company: { type: "string", maxLength: 200 },
  },
  required: ["email", "question"],
  additionalProperties: false,
} as const;

const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: LEAD_STATUSES },
    ...paginationProperties,
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

const createLeadBody = {
  type: "object",
  required: ["name", "email"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    email: { type: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", maxLength: 320 },
    phone: { type: "string", maxLength: 50 },
    location: { type: "string", maxLength: 200 },
    projectType: { type: "string", maxLength: 100 },
    message: { type: "string", maxLength: 5000 },
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
    { schema: { body: consultationBody }, config: { rateLimit: leadsRateLimit } },
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
        cc: config.mail.leadsCcAddresses,
        toName: "BuildPanda Team",
        // Replying answers the person who asked, not the notification sender.
        replyTo: { address: body.email, name: body.name.replace(/[\r\n]+/g, " ") },
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

  // The website's "Ask us anything" box: a question the FAQ did not answer
  // becomes a lead the team replies to, like a consultation request.
  fastify.post<{ Body: PublicQuestion }>(
    "/leads/question",
    {
      schema: { body: questionBody },
      config: { rateLimit: questionRateLimit },
      // A question is a few hundred bytes; refuse anything that is not.
      bodyLimit: 8 * 1024,
    },
    async (request, reply) => {
      const question = cleanPublicQuestion(request.body);
      // Bots get the same reply as people, so they cannot tell they were dropped.
      if (!question) {
        request.log.warn("Website question dropped as automated");
        return reply.status(201).send({ received: true });
      }
      const lead = await service.createLead({
        name: question.name ?? question.email,
        email: question.email,
        projectType: "Website question",
        message: question.question,
        source: "website-faq",
        orgId: null,
      });
      const { subject, html } = websiteQuestionEmail(question);
      await sendEmail({
        to: config.mail.leadsNotifyAddresses,
        cc: config.mail.leadsCcAddresses,
        toName: "BuildPanda Team",
        replyTo: { address: question.email, name: question.name ?? question.email },
        subject,
        html,
      });
      // No address or question text in the log: the lead row holds those.
      request.log.info({ leadId: lead.id }, "Website question received");
      return reply.status(201).send({ received: true });
    },
  );

  fastify.get<{ Querystring: { status?: string; limit?: number; offset?: number } }>(
    "/leads",
    { schema: { querystring: listQuery } },
    async (request) => {
      const orgId = request.requireOrgScope();
      return service.listForOrg(orgId, {
        status: request.query.status,
        limit: request.query.limit ?? 25,
        offset: request.query.offset ?? 0,
      });
    },
  );

  fastify.post<{
    Body: {
      name: string;
      email: string;
      phone?: string;
      location?: string;
      projectType?: string;
      message?: string;
    };
  }>(
    "/leads",
    { schema: { body: createLeadBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("leads", "create");
      const lead = await service.createLead({
        name: request.body.name,
        email: request.body.email,
        phone: request.body.phone,
        location: request.body.location,
        projectType: request.body.projectType,
        message: request.body.message,
        source: "manual",
        orgId,
      });
      return reply.status(201).send(lead);
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { status?: string; notes?: string } }>(
    "/leads/:id",
    { schema: { params: idParams, body: patchBody } },
    async (request, reply) => {
      const orgId = request.requireOrgPermission("leads", "update");
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
