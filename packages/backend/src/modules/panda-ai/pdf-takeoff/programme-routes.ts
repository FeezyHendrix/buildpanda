import type { FastifyPluginAsync } from "fastify";
import type { preconService } from "./service.ts";
import { PRECON_PROGRAMME_QUEUE, type PreconProgrammeJobData } from "./job.ts";
import type { CreateProgrammeTaskBody, UpdateProgrammeTaskBody } from "./types.ts";
import {
  createProgrammeTaskBody,
  programmeStartBody,
  sessionParams,
  taskParams,
  updateProgrammeTaskBody,
  versionOnlyBody,
} from "./route-schemas.ts";

interface ProgrammeRoutesOptions {
  service: ReturnType<typeof preconService>;
}

// ── Programme of work ──────────────────────────────────────────────────────
export const programmeRoutes: FastifyPluginAsync<ProgrammeRoutesOptions> = async (fastify, { service }) => {
  fastify.post<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/programme",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "measure");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      await fastify.queue.enqueue(PRECON_PROGRAMME_QUEUE, "programme", {
        sessionId: request.params.sessionId,
        orgId,
      } satisfies PreconProgrammeJobData);
      return reply.status(202).send({ status: "queued" });
    },
  );

  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/programme",
    { schema: { params: sessionParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return service.getProgramme(request.params.sessionId);
    },
  );

  fastify.patch<{ Params: { sessionId: string }; Body: { startDate: string } }>(
    "/precon/sessions/:sessionId/programme/start",
    { schema: { params: sessionParams, body: programmeStartBody } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return service.setProgrammeStart(request.params.sessionId, request.body.startDate);
    },
  );

  fastify.post<{ Params: { sessionId: string }; Body: CreateProgrammeTaskBody }>(
    "/precon/sessions/:sessionId/programme/tasks",
    { schema: { params: sessionParams, body: createProgrammeTaskBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const task = await service.createProgrammeTask(request.params.sessionId, request.body, user.id);
      return reply.status(201).send(task);
    },
  );

  fastify.delete<{ Params: { taskId: string } }>(
    "/precon/programme-tasks/:taskId",
    { schema: { params: taskParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertProgrammeTaskOrg(request.params.taskId, orgId);
      return service.deleteProgrammeTask(request.params.taskId, user.id);
    },
  );

  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/programme/export.xml",
    { schema: { params: sessionParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const { fileName, xml } = await service.exportProgrammeXml(request.params.sessionId);
      return reply
        .header("content-type", "application/xml; charset=utf-8")
        .header("content-disposition", `attachment; filename="${fileName}"`)
        .send(xml);
    },
  );

  fastify.patch<{ Params: { taskId: string }; Body: UpdateProgrammeTaskBody }>(
    "/precon/programme-tasks/:taskId",
    { schema: { params: taskParams, body: updateProgrammeTaskBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertProgrammeTaskOrg(request.params.taskId, orgId);
      const { version, ...patch } = request.body;
      return service.updateProgrammeTask(request.params.taskId, version, patch, user.id);
    },
  );

  fastify.post<{ Params: { taskId: string }; Body: { version: number } }>(
    "/precon/programme-tasks/:taskId/verify",
    { schema: { params: taskParams, body: versionOnlyBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "verify");
      await service.assertProgrammeTaskOrg(request.params.taskId, orgId);
      return service.setProgrammeTaskStatus(request.params.taskId, request.body.version, "verified", user.id);
    },
  );

  fastify.post<{ Params: { taskId: string }; Body: { version: number } }>(
    "/precon/programme-tasks/:taskId/reject",
    { schema: { params: taskParams, body: versionOnlyBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "verify");
      await service.assertProgrammeTaskOrg(request.params.taskId, orgId);
      return service.setProgrammeTaskStatus(request.params.taskId, request.body.version, "rejected", user.id);
    },
  );
};
