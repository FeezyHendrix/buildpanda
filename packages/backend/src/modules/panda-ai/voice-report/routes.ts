import { voiceActions, permits } from "@buildpanda/voice-actions";
import { computeAccess } from "../../participants/access.ts";
import { voiceContextRepository } from "./context-repository.ts";
import { canProjectPermission } from "../../../lib/authorization.ts";
import { canCapture, canPropose } from "./permissions.ts";
import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { config } from "../../../config/index.ts";
import { BadRequestError, ForbiddenError } from "../../../lib/errors.ts";
import { voiceReportRepository } from "./repository.ts";
import { transcribeAndClassify } from "./service.ts";

const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

const voiceReportRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: config.uploads.maxFileBytes, files: 1 },
  });

  const repository = voiceReportRepository(fastify.db);
  const contextRepository = voiceContextRepository(fastify.db);

  // No `response` schema: the body is model-drafted JSON, not DB rows, so there
  // is no column to allowlist — the shape is already guaranteed by the zod
  // validation in the service.
  fastify.post<{ Params: { id: string } }>(
    "/projects/:id/ai/voice-report",
    { schema: { params: projectIdParams } },
    async (request) => {
      const project = await request.requireProjectPermission(request.params.id, "project", "view");

      const can = (resource: string, action: string) => canProjectPermission(
        { id: project.id, ownerId: project.owner_id, organizationId: project.organization_id },
        { userId: request.requireAuth().id, orgRoles: request.orgRoles, orgPermissions: request.orgPermissions,
          projectRoles: request.projectRoles, projectSectionPermissions: request.projectSectionPermissions, projectGrants: request.projectGrants }, resource, action);
      const capabilities = computeAccess(project, request).capabilities;
      const workspaceCan = (resource: string, action: string) => !!project.organization_id && request.orgPermissions.get(project.organization_id)?.get(resource)?.has(action) === true;
      if (!canCapture(can, capabilities, workspaceCan)) throw new ForbiddenError("Your permissions do not allow voice capture on this project.");
      const part = await request.file();
      if (!part) throw new BadRequestError("Missing audio upload");

      const buffer = await part.toBuffer();
      const audio = new Blob([buffer], { type: part.mimetype || "audio/m4a" });
      const company = project.owner_id === request.user!.id || Boolean(project.organization_id && request.orgRoles.has(project.organization_id));
      const snapshot = await repository.snapshot(project.id, (resource) => can(resource, "view"), !company);
      snapshot.allowedActionKinds = Object.entries(voiceActions).filter(([, definition]) => permits(definition.permission, can, capabilities, workspaceCan)).map(([kind]) => kind);
      const options = await contextRepository.options(project.id, { userId: request.user!.id, organizationId: project.organization_id ?? "", can, workspaceCan, capabilities });
      snapshot.voiceOptions = { ...options,
        buildings: snapshot.buildings.map((row) => ({ value: row.id, label: row.name })),
        stages: snapshot.stages.map((row) => ({ value: row.id, label: row.name, buildingId: row.buildingId })),
        respondableRfis: snapshot.rfis.filter((row) => ["Open", "InReview", "Answered"].includes(row.status)).map((row) => ({ value: row.id, label: `RFI-${row.number}: ${row.subject}` })),
        receivableOrders: snapshot.materialOrders.filter((row) => ["Approved", "Ordered", "PartiallyDelivered"].includes(row.status)).map((row) => ({ value: row.id, label: row.title })),
      };
      const report = await transcribeAndClassify(audio, part.filename || "field-note.m4a", snapshot);
      return { ...report, actions: report.actions.filter((action) => canPropose(action, can, capabilities, workspaceCan)) };
    },
  );
};

export default voiceReportRoutes;
