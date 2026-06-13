import type { FastifyPluginAsync } from "fastify";
import { proposalsRepository } from "./repository.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { sendEmail } from "../../lib/mail.ts";
import { proposalResponseEmail } from "../../lib/email-templates.ts";
import { config } from "../../config/index.ts";

const tokenParams = {
  type: "object",
  properties: { token: { type: "string", minLength: 1 } },
  required: ["token"],
  additionalProperties: false,
} as const;

const respondBody = {
  type: "object",
  required: ["action"],
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["accept", "decline", "change_requested"] },
    name: { type: "string", maxLength: 200 },
  },
} as const;

const publicProposalRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = proposalsRepository(fastify.db);

  fastify.get<{ Params: { token: string } }>(
    "/proposals/public/:token",
    { schema: { params: tokenParams } },
    async (request) => {
      const result = await repo.getByShareToken(request.params.token);
      if (!result) throw new NotFoundError("Proposal");

      const { proposal, estimate } = result;

      // Log a "viewed" event if not already logged for this token
      const existing = await fastify.db("proposal_events")
        .where({ proposal_id: proposal.id, type: "client_viewed" })
        .count<{ count: string }[]>("id as count")
        .first();

      if (!existing || Number(existing.count) === 0) {
        await repo.logEvent(proposal.id, "client_viewed", null, {
          estimateId: estimate.id,
        });
      }

      const [items, schedule] = await Promise.all([
        repo.getItems(estimate.id),
        repo.getSchedule(estimate.id),
      ]);

      return {
        proposal: repo.toProposal(proposal),
        estimate: { ...repo.toEstimate(estimate), items, schedule },
      };
    },
  );

  fastify.post<{
    Params: { token: string };
    Body: { action: "accept" | "decline" | "change_requested"; name?: string };
  }>(
    "/proposals/public/:token/respond",
    { schema: { params: tokenParams, body: respondBody } },
    async (request, reply) => {
      const result = await repo.getByShareToken(request.params.token);
      if (!result) throw new NotFoundError("Proposal");

      const { proposal, estimate } = result;

      if (estimate.status !== "Sent") {
        throw new BadRequestError("This proposal is no longer open for responses.");
      }

      const now = new Date().toISOString();
      const { action, name } = request.body;
      const responderName = name?.trim() || proposal.client_name;

      // Map action → estimate + proposal status
      if (action === "accept") {
        await repo.updateEstimateMeta(estimate.id, {
          status: "Accepted",
          acceptedAt: now,
          acceptedByName: responderName,
        });
        await repo.updateProposal(proposal.id, proposal.org_id, { status: "Accepted" });
        await repo.logEvent(proposal.id, "client_accepted", null, {
          estimateId: estimate.id,
          name: responderName,
        });
      } else if (action === "decline") {
        await repo.updateEstimateMeta(estimate.id, { status: "Declined" });
        await repo.updateProposal(proposal.id, proposal.org_id, { status: "Lost" });
        await repo.logEvent(proposal.id, "client_declined", null, {
          estimateId: estimate.id,
          name: responderName,
        });
      } else {
        // change_requested — leave estimate Sent, move proposal to UnderReview
        await repo.updateProposal(proposal.id, proposal.org_id, { status: "UnderReview" });
        await repo.logEvent(proposal.id, "client_change_requested", null, {
          estimateId: estimate.id,
          name: responderName,
        });
      }

      // Notify the company by email
      const org = await fastify.db("organization")
        .where({ id: proposal.org_id })
        .select("contact_email", "name")
        .first();

      const notifyEmail = (org?.contact_email as string | undefined) ?? null;
      if (notifyEmail) {
        const workspaceUrl = `${config.mail.appUrl}/sales/proposals/${proposal.id}`;
        const tpl = proposalResponseEmail({
          action,
          clientName: responderName,
          proposalTitle: proposal.title,
          proposalNumber: `BP-${String(proposal.number).padStart(4, "0")}`,
          shareUrl: workspaceUrl,
        });
        void sendEmail({ to: notifyEmail, ...tpl }).catch((err) =>
          fastify.log.error({ err }, "Failed to send proposal response email"),
        );
      }

      return reply.status(200).send({ ok: true, action });
    },
  );
};

export default publicProposalRoutes;
