import type { FastifyPluginAsync } from "fastify";
import { proposalsRepository } from "./repository.ts";
import { proposalTermsRepository } from "./terms-repository.ts";
import { publicViewService } from "./public-view.ts";
import { BadRequestError } from "../../lib/errors.ts";
import { sendEmail } from "../../lib/mail.ts";
import { proposalResponseEmail } from "../../lib/email-templates.ts";
import { config } from "../../config/index.ts";
import { publicTokenRateLimit } from "../../plugins/security.ts";
import { CLIENT_RESPONSES, type PublicRespondInput } from "./types.ts";

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
    action: { type: "string", enum: CLIENT_RESPONSES },
    name: { type: "string", maxLength: 200 },
    message: { type: "string", maxLength: 4000 },
  },
} as const;

// The public link is proof of possession, not identity. It can read the offer
// and respond to it, nothing else, and every response is recorded with who
// typed it, when, from where, and against which document.
const publicProposalRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = proposalsRepository(fastify.db);
  const terms = proposalTermsRepository(fastify.db);
  const views = publicViewService(fastify.db, repo, terms);

  fastify.get<{ Params: { token: string } }>(
    "/proposals/public/:token",
    { schema: { params: tokenParams }, config: { rateLimit: publicTokenRateLimit } },
    async (request) => {
      const { view, estimateId } = await views.byToken(request.params.token);
      // every open is logged, so the workspace can show a count and a last-viewed time
      await repo.logEvent(view.proposal.id, "client_viewed", null, {
        estimateId,
        ip: request.ip,
        userAgent: request.headers["user-agent"] ?? null,
      });
      return { ...view, viewCount: view.viewCount + 1 };
    },
  );

  fastify.post<{ Params: { token: string }; Body: PublicRespondInput }>(
    "/proposals/public/:token/respond",
    { schema: { params: tokenParams, body: respondBody }, config: { rateLimit: publicTokenRateLimit } },
    async (request, reply) => {
      const { view, estimateId, orgId } = await views.byToken(request.params.token);
      const { proposal, estimate } = view;

      if (estimate.status !== "Sent") {
        throw new BadRequestError("This proposal is no longer open for responses.");
      }

      const { action } = request.body;
      const name = request.body.name?.trim() ?? "";
      const message = request.body.message?.trim() || null;
      if (action === "accept" && !name) throw new BadRequestError("Type your name to accept the proposal.");
      if (action === "change_requested" && !message) {
        throw new BadRequestError("Tell the contractor what you would like changed.");
      }

      const at = new Date().toISOString();
      const responderName = name || proposal.clientName;
      const evidence = {
        action,
        name: responderName,
        message,
        ip: request.ip ?? null,
        userAgent: (request.headers["user-agent"] as string | undefined) ?? null,
        at,
      };
      await terms.recordResponse(estimateId, evidence);

      const eventMeta = {
        estimateId,
        name: responderName,
        message,
        ip: evidence.ip,
        pdfHash: estimate.acceptedPdfHash,
      };
      if (action === "accept") {
        await repo.updateEstimateMeta(estimateId, { status: "Accepted", acceptedAt: at, acceptedByName: responderName });
        await repo.updateProposal(proposal.id, orgId, { status: "Accepted" });
        await repo.logEvent(proposal.id, "client_accepted", null, eventMeta);
      } else if (action === "decline") {
        await repo.updateEstimateMeta(estimateId, { status: "Declined" });
        await repo.updateProposal(proposal.id, orgId, { status: "Lost" });
        await repo.logEvent(proposal.id, "client_declined", null, eventMeta);
      } else {
        // the estimate stays Sent; the contractor decides whether to redraft
        await repo.updateProposal(proposal.id, orgId, { status: "UnderReview" });
        await repo.logEvent(proposal.id, "client_change_requested", null, eventMeta);
      }

      const org = await fastify.db("organization").where({ id: orgId }).select("contact_email", "name").first();
      const notifyEmail = (org?.contact_email as string | undefined) ?? null;
      if (notifyEmail) {
        const tpl = proposalResponseEmail({
          action,
          clientName: responderName,
          proposalTitle: proposal.title,
          proposalNumber: proposal.numberLabel,
          shareUrl: `${config.mail.appUrl}/sales/proposals/${proposal.id}`,
        });
        void sendEmail({ to: notifyEmail, ...tpl }).catch((err) =>
          fastify.log.error({ err }, "Failed to send proposal response email"),
        );
      }

      return reply.status(200).send({ ok: true, action, acceptedAt: action === "accept" ? at : null });
    },
  );
};

export default publicProposalRoutes;
