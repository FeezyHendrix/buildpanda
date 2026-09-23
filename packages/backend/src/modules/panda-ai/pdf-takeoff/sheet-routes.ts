import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "../../../lib/errors.ts";
import { openStoredFile } from "../../../lib/file-storage.ts";
import { calibrationService } from "./editor-service.ts";
import type { PreconRepository } from "./repository.ts";
import type { preconService } from "./service.ts";
import { PICTURE_CONTENT_TYPE } from "./types.ts";
import type { CalibrationPreviewBody, ViewportPreviewBody } from "./types.ts";
import { sheetParams } from "./route-schemas.ts";
import {
  calibrationPreviewBody,
  calibrationPreviewResponse,
  viewportPreviewBody,
  viewportPreviewResponse,
} from "./sheet-schemas.ts";

interface SheetRoutesOptions {
  service: ReturnType<typeof preconService>;
  repo: PreconRepository;
}

// What the viewer needs to draw on a sheet: the stored drawing itself, the snap
// points the engine indexed for it, and the two PREVIEWS that say what changing
// the scale or the scale regions would do to the figures on it.
//
// The matching writes deliberately do not live here. They used to — a direct
// `POST .../calibration` and `PATCH .../viewports` — and that was a way to
// restate every quantity on a drawing with no operation id, no expected row
// versions, no fingerprint and no receipt, so the result could not be replayed
// safely and could not be undone at all. Both now go through the one write
// envelope as `apply-calibration` and `apply-viewports` commands.
export const sheetRoutes: FastifyPluginAsync<SheetRoutesOptions> = async (fastify, { service, repo }) => {
  const calibration = calibrationService(fastify.db);

  fastify.get<{ Params: { sheetId: string } }>(
    "/precon/sheets/:sheetId/file",
    { schema: { params: sheetParams } },
    async (request, reply) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      const sheet = await repo.sheetById(request.params.sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      await service.assertSessionOrg(sheet.session_id, orgId);
      const stream = await openStoredFile(sheet.storage_path);
      const ext = sheet.file_name.split(".").pop()?.toLowerCase() ?? "";
      return reply.header("content-type", PICTURE_CONTENT_TYPE[ext] ?? "application/pdf").send(stream);
    },
  );

  fastify.get<{ Params: { sheetId: string } }>(
    "/precon/sheets/:sheetId/snap",
    { schema: { params: sheetParams } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "view");
      const sheet = await repo.sheetById(request.params.sheetId);
      if (!sheet) throw new NotFoundError("Sheet");
      await service.assertSessionOrg(sheet.session_id, orgId);
      return { points: sheet.snap_index ?? [] };
    },
  );

  // Before and after for every line on the drawing, so the QS commits a scale
  // having seen what it does to the bill. It writes nothing and takes no lock.
  fastify.post<{ Params: { sheetId: string }; Body: CalibrationPreviewBody }>(
    "/precon/sheets/:sheetId/calibration-preview",
    { schema: { params: sheetParams, body: calibrationPreviewBody, response: calibrationPreviewResponse } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSheetOrg(request.params.sheetId, orgId);
      return calibration.previewCalibration(request.params.sheetId, request.body);
    },
  );

  // What changing the scale regions would do to the measurements taken inside
  // them, before any of it is committed. Writes nothing and takes no lock.
  fastify.post<{ Params: { sheetId: string }; Body: ViewportPreviewBody }>(
    "/precon/sheets/:sheetId/viewport-preview",
    { schema: { params: sheetParams, body: viewportPreviewBody, response: viewportPreviewResponse } },
    async (request) => {
      request.requireAuth();
      const orgId = request.requireOrgPermission("takeoffs", "edit");
      await service.assertSheetOrg(request.params.sheetId, orgId);
      return calibration.previewViewports(request.params.sheetId, request.body);
    },
  );

};
