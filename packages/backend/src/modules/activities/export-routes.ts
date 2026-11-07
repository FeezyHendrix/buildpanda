import type { FastifyPluginAsync } from "fastify";
import { idParams as projectIdParams } from "../../lib/schemas.ts";
import { programmeToMspdiXml } from "./programme-export.ts";
import { programmeToPdf, programmeToXlsx } from "./programme-files.ts";
import { activitiesRepository } from "./repository.ts";
import { activitiesService } from "./service.ts";

const FORMATS = ["xlsx", "xml", "pdf"] as const;
type Format = (typeof FORMATS)[number];

const query = {
  type: "object",
  additionalProperties: false,
  properties: {
    format: { type: "string", enum: FORMATS },
    buildingId: { type: "string", maxLength: 100 },
  },
} as const;

const CONTENT_TYPE: Record<Format, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xml: "application/xml; charset=utf-8",
  pdf: "application/pdf",
};

/**
 * Export Programme: a file a planner can open. xlsx for a sheet, xml (MSPDI)
 * to round-trip with Import programme, pdf as printed. Honours the viewer's
 * schedule view right and building scope.
 */
const programmeExportRoutes: FastifyPluginAsync = async (fastify) => {
  // Read-only: no recompute, no notifications.
  const service = activitiesService(activitiesRepository(fastify.db));

  fastify.get<{ Params: { id: string }; Querystring: { format?: Format; buildingId?: string } }>(
    "/projects/:id/programme/export",
    { schema: { params: projectIdParams, querystring: query } },
    async (request, reply) => {
      const project = await request.requireProjectPermission(request.params.id, "schedule", "view");
      const user = request.requireAuth();
      const format = request.query.format ?? "xlsx";
      const activities = await service.listByProject(project.id, request.query.buildingId);
      const body =
        format === "xml" ? programmeToMspdiXml(project.name, activities)
        : format === "pdf" ? await programmeToPdf(project.name, activities)
        : await programmeToXlsx(project.name, activities);
      const fileName = `${project.name.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}-programme.${format}`;
      // Who exported what, when: the export is a copy of a contractual record.
      request.log.info({ projectId: project.id, userId: user.id, format, activities: activities.length }, "programme exported");
      return reply
        .header("content-type", CONTENT_TYPE[format])
        .header("content-disposition", `attachment; filename="${fileName}"`)
        .send(body);
    },
  );
};

export default programmeExportRoutes;
