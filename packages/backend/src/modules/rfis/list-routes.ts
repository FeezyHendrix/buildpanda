import type { FastifyPluginAsync } from "fastify";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { isCompanyCaller } from "./caller.ts";
import { rfiListRepository } from "./list-repository.ts";
import { rfiListService } from "./list-service.ts";
import { rfisRepository } from "./repository.ts";
import { RFI_PRIORITIES, RFI_SORTS, RFI_STATUSES, type RfiListQuery } from "./types.ts";

const day = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } as const;

// `page` (or any of the new filters) switches the response from the plain
// array to the paged shape; `status` alone keeps the old contract.
const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "array", items: { type: "string", enum: RFI_STATUSES }, maxItems: 6 },
    ballInCourt: { type: "string", enum: ["mine"] },
    overdue: { type: "boolean" },
    q: { type: "string", maxLength: 200 },
    priority: { type: "array", items: { type: "string", enum: RFI_PRIORITIES }, maxItems: 3 },
    dueFrom: day,
    dueTo: day,
    page: { type: "integer", minimum: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 100 },
    sort: { type: "string", enum: RFI_SORTS },
  },
} as const;

type Query = RfiListQuery & { ballInCourt?: "mine" };

const rfiListRoutes: FastifyPluginAsync = async (fastify) => {
  const rfis = rfisRepository(fastify.db);
  const service = rfiListService(rfiListRepository(fastify.db, rfis), rfis);

  fastify.get<{ Params: { id: string }; Querystring: Query }>(
    "/projects/:id/rfis",
    { schema: { params: projectIdParams, querystring: listQuery } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "rfis", "view");
      const user = request.requireAuth();
      const { ballInCourt, ...rest } = request.query;
      const query: RfiListQuery = { ...rest, ballInCourtId: ballInCourt === "mine" ? user.id : undefined };
      const paged = ["page", "q", "overdue", "priority", "dueFrom", "dueTo", "sort"].some((k) => (rest as Record<string, unknown>)[k] !== undefined);
      const company = isCompanyCaller(request, project);
      return paged ? service.page(project.id, query, company) : service.all(project.id, query, company);
    },
  );
};

export default rfiListRoutes;
