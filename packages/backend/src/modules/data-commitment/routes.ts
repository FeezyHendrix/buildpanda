import type { FastifyPluginAsync } from "fastify";
import { ForbiddenError } from "../../lib/errors.ts";
import { dataCommitmentRepository } from "./repository.ts";
import { dataCommitmentService } from "./service.ts";

const dataCommitmentRoutes: FastifyPluginAsync = async (fastify) => {
  const service = dataCommitmentService(dataCommitmentRepository(fastify.db));

  fastify.get("/data-commitment", async (request) => {
    const orgId = request.requireOrgScope();
    return service.status(orgId);
  });

  fastify.post("/data-commitment/accept", async (request, reply) => {
    const orgId = request.requireOrgScope();
    const user = request.requireAuth();
    if (request.orgRoles.get(orgId) !== "owner") {
      throw new ForbiddenError("Only the workspace owner can accept the data commitment");
    }
    // The commitment is for the construction company/workspace owner, not a
    // project client — project_owner accounts never accept it.
    const account = await fastify.db("user").where({ id: user.id }).select("accountType").first<{ accountType: string | null }>();
    if (account?.accountType === "project_owner") {
      throw new ForbiddenError("The data commitment is accepted by the company workspace owner");
    }
    const status = await service.accept(orgId, { id: user.id, name: user.name });
    return reply.status(201).send(status);
  });
};

export default dataCommitmentRoutes;
