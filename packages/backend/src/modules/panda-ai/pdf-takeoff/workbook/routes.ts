// The workbook's four endpoints.
//
// Every one is organization-scoped twice over: `requireOrgPermission` settles
// what the caller may do anywhere, and `assertSessionOrg` settles that THIS
// take-off belongs to that organization. Without the second, a guessed session
// id would reach another organization's bill — and because a missing session
// and a foreign one both raise the same 404, an id cannot be used to discover
// that someone else's take-off exists.
//
// Reading needs `view`; saving and undoing need `edit`. An undo deliberately
// does NOT need `verify`: reversing invalidates a sign-off rather than
// conferring one.

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { workbookExportService } from "./export-service.ts";
import { workbookReverseService } from "./reverse.ts";
import {
  workbookEventParams,
  workbookHistoryQuery,
  workbookOperationBody,
  workbookReverseBody,
  workbookSessionParams,
} from "./schemas.ts";
import { workbookService } from "./service.ts";
import type { WorkbookReverseRequest, WorkbookSaveRequest } from "./types.ts";
import type { preconService, PublishFn } from "../service.ts";

interface WorkbookRoutesOptions {
  service: ReturnType<typeof preconService>;
  publish: PublishFn;
}

/**
 * A signal that fires when the caller genuinely goes away, so a 15-second
 * calculation nobody is waiting for is terminated instead of finished.
 *
 * It listens on the RESPONSE, not the request. On Node 16+ an `IncomingMessage`
 * emits `close` when the request has been *completed* — i.e. once the body has
 * been read, which for a POST is before the handler even starts — so a listener
 * there either fires on every healthy request (cancelling work that was fine)
 * or, because Fastify has already consumed the body, never fires at all.
 * Neither is a disconnect. A `ServerResponse` emits `close` exactly once, when
 * the exchange ends, and `writableEnded` then distinguishes "we replied" from
 * "the socket went away first".
 *
 * The up-front check covers the caller that vanished while the route was still
 * doing its auth round-trips: by then `close` may already have fired, and a
 * listener attached afterwards would wait forever.
 *
 * `request.raw.destroyed` alone is NOT a disconnect — a request stream is
 * destroyed as a matter of course once its body has been read, which by the
 * time these routes have finished authorising is true of every healthy POST.
 * Only a request destroyed while still INCOMPLETE is a caller that left.
 */
export function abortOnDisconnect(request: FastifyRequest, reply: FastifyReply): { signal: AbortSignal; done(): void } {
  const controller = new AbortController();
  const clientLeft = (): boolean => reply.raw.destroyed || (request.raw.destroyed && !request.raw.complete);
  const gone = (): boolean => !reply.raw.writableEnded && clientLeft();
  const onClose = (): void => {
    if (!reply.raw.writableEnded) controller.abort();
  };
  reply.raw.once("close", onClose);
  if (gone()) controller.abort();
  return {
    signal: controller.signal,
    done: () => reply.raw.removeListener("close", onClose),
  };
}

export const workbookRoutes: FastifyPluginAsync<WorkbookRoutesOptions> = async (fastify, { service, publish }) => {
  const workbook = workbookService(fastify.db, publish);
  const reverse = workbookReverseService(fastify.db, workbook, publish);
  const exporter = workbookExportService(fastify.db, workbook, (sessionId) =>
    service.boundRepository.projectNameForSession(sessionId),
  );

  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/workbook",
    { schema: { params: workbookSessionParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const disconnect = abortOnDisconnect(request, reply);
      try {
        return await workbook.read(request.params.sessionId, user.id, disconnect.signal);
      } finally {
        disconnect.done();
      }
    },
  );

  // Reading a workbook and downloading it are the same act, so the same `view`
  // grant covers both. The existing `/precon/sessions/:sessionId/export.xlsx`
  // is untouched: that exports the BILL as a priced document, this exports the
  // WORKBOOK, formulas and scratch worksheets included, and a QS wants both.
  fastify.get<{ Params: { sessionId: string } }>(
    "/precon/sessions/:sessionId/workbook/export.xlsx",
    { schema: { params: workbookSessionParams } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const disconnect = abortOnDisconnect(request, reply);
      try {
        const file = await exporter.exportXlsx(request.params.sessionId, user.id, disconnect.signal);
        return await reply
          .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          .header("content-disposition", `attachment; filename="${file.fileName}"`)
          .send(file.buffer);
      } finally {
        disconnect.done();
      }
    },
  );

  fastify.get<{ Params: { sessionId: string }; Querystring: { limit?: number } }>(
    "/precon/sessions/:sessionId/workbook/history",
    { schema: { params: workbookSessionParams, querystring: workbookHistoryQuery } },
    async (request) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      return workbook.history(request.params.sessionId, user.id, request.query.limit);
    },
  );

  fastify.post<{ Params: { sessionId: string }; Body: WorkbookSaveRequest }>(
    "/precon/sessions/:sessionId/workbook/operations",
    {
      // Past this, Fastify refuses before a byte reaches a validator. It sits
      // above the module's own 2 MiB document bound on purpose, so a document
      // between the two is refused by the engine — which can say WHICH bound was
      // exceeded and by how much — rather than by a bare framework 413.
      bodyLimit: 4 * 1024 * 1024,
      schema: { params: workbookSessionParams, body: workbookOperationBody },
    },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const disconnect = abortOnDisconnect(request, reply);
      try {
        return await workbook.save(request.params.sessionId, request.body, user.id, disconnect.signal);
      } finally {
        disconnect.done();
      }
    },
  );

  fastify.post<{ Params: { sessionId: string; eventId: string }; Body: WorkbookReverseRequest }>(
    "/precon/sessions/:sessionId/workbook/operations/:eventId/reverse",
    { schema: { params: workbookEventParams, body: workbookReverseBody } },
    async (request, reply) => {
      const user = request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSessionOrg(request.params.sessionId, orgId);
      const disconnect = abortOnDisconnect(request, reply);
      try {
        return await reverse.reverse(
          request.params.sessionId,
          request.params.eventId,
          request.body,
          user.id,
          disconnect.signal,
        );
      } finally {
        disconnect.done();
      }
    },
  );
};
