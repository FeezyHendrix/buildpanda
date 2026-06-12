import type { FastifyPluginAsync } from "fastify";
import { sendEmail } from "../../lib/mail.ts";
import {
  consultationLeadEmail,
  type ConsultationLead,
} from "../../lib/email-templates.ts";
import { config } from "../../config/index.ts";

const consultationBody = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    // ajv-formats isn't registered, so validate shape with a pattern instead
    // of format: "email".
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

/**
 * Public lead-capture endpoints used by the marketing site (buildpanda.io).
 * No auth — the consultation form is filled in by anonymous visitors. The
 * lead is delivered to the team inbox (config.mail.leadsNotifyAddress).
 */
const leadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: ConsultationLead }>(
    "/leads/consultation",
    { schema: { body: consultationBody } },
    async (request, reply) => {
      const { subject, html } = consultationLeadEmail(request.body);
      await sendEmail({
        to: config.mail.leadsNotifyAddresses,
        toName: "BuildPanda Team",
        subject,
        html,
      });
      request.log.info(
        { email: request.body.email, projectType: request.body.projectType },
        "Consultation lead received",
      );
      return reply.status(201).send({ received: true });
    },
  );
};

export default leadRoutes;
