import type { FastifyPluginAsync } from "fastify";
import { idParams } from "../../lib/schemas.ts";
import { NotFoundError } from "../../lib/errors.ts";
import { proposalsRepository } from "./repository.ts";
import { proposalTermsRepository } from "./terms-repository.ts";
import { packService, type PackDraftContext } from "./pack-service.ts";
import { preconRepository } from "../panda-ai/pdf-takeoff/repository.ts";
import { preconService } from "../panda-ai/pdf-takeoff/service.ts";
import { PACK_ORIGINS, PACK_SECTION_KINDS, type PackSectionKind, type UpsertPackSectionInput } from "./types.ts";

const kindParams = {
  type: "object",
  required: ["id", "kind"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    kind: { type: "string", enum: PACK_SECTION_KINDS },
  },
} as const;

const upsertBody = {
  type: "object",
  required: ["kind", "bodyHtml"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: PACK_SECTION_KINDS },
    bodyHtml: { type: "string", maxLength: 200000 },
    origin: { type: "string", enum: PACK_ORIGINS },
  },
} as const;

const draftBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    kinds: { type: "array", maxItems: 7, items: { type: "string", enum: PACK_SECTION_KINDS } },
  },
} as const;

const packRoutes: FastifyPluginAsync = async (fastify) => {
  const repo = proposalsRepository(fastify.db);
  const terms = proposalTermsRepository(fastify.db);
  const service = packService(repo, terms);
  const precon = preconService(preconRepository(fastify.db));

  // The draft reads what the proposal already knows: brief, the structure the
  // engine read from the drawings, and the bill sections it measured.
  async function draftContext(proposalId: string, orgId: string): Promise<PackDraftContext> {
    const proposal = await repo.getById(proposalId, orgId);
    if (!proposal) throw new NotFoundError("Proposal");
    const sessions = await precon.listSessions(orgId, proposalId);
    const measured =
      sessions.find((s: { status: string }) => s.status === "reviewing" || s.status === "output") ?? sessions[0];
    let structure: string | null = null;
    let billSummary: string[] = [];
    if (measured) {
      const snapshot = await precon.getSnapshot(measured.id);
      const ctx = snapshot.session.structureContext;
      if (ctx && ctx.structureClass !== "unknown") {
        structure = [ctx.structureClass, ctx.buildingType, ctx.storeys ? `${ctx.storeys} storeys` : null, ctx.structuralSystem, `${ctx.foundationType} foundation`]
          .filter(Boolean)
          .join(", ");
      }
      billSummary = snapshot.bills.map((b) => `${b.title} (${snapshot.rows.filter((r) => r.billId === b.id && r.rowType === "item").length} items)`);
    }
    return {
      title: proposal.title,
      clientName: proposal.client_name,
      location: proposal.location,
      brief: proposal.brief,
      jobProfile: (proposal as { job_profile?: string }).job_profile ?? "full_contract",
      structure,
      billSummary,
    };
  }

  fastify.get<{ Params: { id: string } }>("/proposals/:id/pack", { schema: { params: idParams } }, async (request) => {
    request.requireAuth();
    const orgId = request.requireOrgScope();
    return service.list(request.params.id, orgId);
  });

  fastify.put<{ Params: { id: string }; Body: UpsertPackSectionInput }>(
    "/proposals/:id/pack",
    { schema: { params: idParams, body: upsertBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      return service.upsert(request.params.id, orgId, user.id, request.body);
    },
  );

  fastify.delete<{ Params: { id: string; kind: PackSectionKind } }>(
    "/proposals/:id/pack/:kind",
    { schema: { params: kindParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      return service.remove(request.params.id, orgId, request.params.kind);
    },
  );

  fastify.post<{ Params: { id: string }; Body: { kinds?: PackSectionKind[] } }>(
    "/proposals/:id/pack/draft",
    { schema: { params: idParams, body: draftBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("proposals", "update");
      const context = await draftContext(request.params.id, orgId);
      const sections = await service.draft(request.params.id, orgId, user.id, context, request.body.kinds);
      return reply.status(201).send(sections);
    },
  );
};

export default packRoutes;
