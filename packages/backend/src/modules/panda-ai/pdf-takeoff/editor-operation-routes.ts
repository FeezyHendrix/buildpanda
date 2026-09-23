import type { FastifyPluginAsync } from "fastify";
import { grantsOf } from "./editor-grants.ts";
import { preconAuditRepository } from "./audit-repository.ts";
import { editorHistoryService } from "./editor-operation-history.ts";
import {
  editorEventParams,
  editorHistoryQuery,
  editorOperationBody,
  editorSessionParams,
} from "./editor-operation-schemas.ts";
import { editorOperationService } from "./editor-operation-service.ts";
import type { EditorOperationRequest } from "./editor-operation-types.ts";
import { editorReverseServiceWith } from "./editor-reverse-service.ts";
import { createOperationUnitOfWork } from "./editor-unit-of-work.ts";
import { reverseOperationBody } from "./route-schemas.ts";
import type { PublishFn, preconService } from "./service.ts";
import type { ReverseOperationBody } from "./types.ts";

interface EditorOperationRoutesOptions {
  service: ReturnType<typeof preconService>;
  publish: PublishFn;
}

// Every route here is organization-scoped twice over: `requireOrgPermission`
// establishes what the caller may do, and `assertSessionOrg` establishes that
// THIS session belongs to that organization. Without the second, a guessed
// session id would reach another organization's drawing.
//
// The grants are then handed to the service rather than being enforced only here,
// because what an operation needs depends on the command inside it: an ordinary
// edit needs `edit`, bringing a new measurement into being also needs `measure`,
// and signing the result off also needs `verify`.

export const editorOperationRoutes: FastifyPluginAsync<EditorOperationRoutesOptions> = async (
  fastify,
  { service, publish },
) => {
  const audits = preconAuditRepository(fastify.db);
  const operations = editorOperationService(fastify.db, publish);
  const reverse = editorReverseServiceWith(createOperationUnitOfWork(fastify.db, publish), audits);
  const history = editorHistoryService(audits);

  fastify.post<{ Params: { sessionId: string }; Body: EditorOperationRequest }>(
    "/precon/sessions/:sessionId/editor-operations",
    {
      // Contract 9's 8 MiB request bound. Fastify's default is 1 MiB, which a
      // legitimate batch of large shapes exceeds; past 8 MiB Fastify refuses with
      // its own 413 before a byte reaches a writer.
      bodyLimit: 8 * 1024 * 1024,
      schema: { params: editorSessionParams, body: editorOperationBody },
    },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return operations.apply(request.params.sessionId, request.body, user.id, grantsOf(request, orgId));
    },
  );

  fastify.get<{ Params: { sessionId: string }; Querystring: { sheetId?: string; limit?: number } }>(
    "/precon/sessions/:sessionId/editor-operations",
    { schema: { params: editorSessionParams, querystring: editorHistoryQuery } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return history.history(request.params.sessionId, user.id, request.query.sheetId, request.query.limit);
    },
  );

  fastify.get<{ Params: { sessionId: string; eventId: string } }>(
    "/precon/sessions/:sessionId/editor-operations/:eventId",
    { schema: { params: editorEventParams } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return history.receipt(request.params.sessionId, request.params.eventId, user.id);
    },
  );

  fastify.post<{ Params: { sessionId: string; eventId: string }; Body: ReverseOperationBody }>(
    "/precon/sessions/:sessionId/editor-operations/:eventId/reverse",
    { schema: { params: editorEventParams, body: reverseOperationBody } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return reverse.reverseOperation(
        request.params.sessionId,
        request.params.eventId,
        request.body,
        user.id,
        grantsOf(request, orgId),
      );
    },
  );
};
