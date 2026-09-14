import type { FastifyPluginAsync } from "fastify";
import { BadRequestError, NotFoundError } from "../../../lib/errors.ts";
import { preconRepository } from "./repository.ts";
import { preconService } from "./service.ts";
import { proposalsRepository } from "../../proposals/repository.ts";
import { proposalsService } from "../../proposals/service.ts";
import { APPLY_MODES } from "./types.ts";
import { diffTakeoffAgainstEstimate, itemsToWrite } from "./apply-to-estimate.ts";
import type { ApplyToEstimateBody } from "./types.ts";

const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const applyToEstimateBody = {
  type: "object",
  required: ["estimateId", "mode"],
  additionalProperties: false,
  properties: {
    estimateId: { type: "string", minLength: 1, maxLength: 100 },
    mode: { type: "string", enum: APPLY_MODES },
  },
} as const;

const applyToEstimateRoutes: FastifyPluginAsync = async (fastify) => {
  const service = preconService(preconRepository(fastify.db));

  // Take-off → estimate. `preview` returns the diff against the estimate's
  // current items; `apply` writes it through the proposals service so the
  // Draft-only rule and totals recalculation hold. Items linked to other
  // take-offs or typed by hand are untouched.
  fastify.post<{ Params: { sessionId: string }; Body: ApplyToEstimateBody }>(
    "/precon/sessions/:sessionId/apply-to-estimate",
    { schema: { params: sessionParams, body: applyToEstimateBody } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "apply");
      const session = await service.assertSessionOrg(request.params.sessionId, orgId);
      if (!session.proposalId) throw new BadRequestError("This take-off is not linked to a proposal");
      const proposalsRepo = proposalsRepository(fastify.db);
      const estimate = await proposalsRepo.getEstimate(request.body.estimateId);
      if (!estimate || estimate.proposalId !== session.proposalId) throw new NotFoundError("Estimate");
      const [snapshot, existing] = await Promise.all([
        service.getSnapshot(session.id),
        proposalsRepo.getItems(estimate.id),
      ]);
      const preview = diffTakeoffAgainstEstimate(session.id, snapshot.bills, snapshot.rows, existing);
      if (request.body.mode === "preview") return preview;
      const proposals = proposalsService(proposalsRepo);
      const items = await proposals.saveEstimateItems(estimate.id, session.proposalId, orgId, itemsToWrite(preview));
      return { ...preview, items: preview.items.filter((i) => i.change !== "removed"), written: items.length };
    },
  );

};

export default applyToEstimateRoutes;
