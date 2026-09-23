// Writing an alignment, and proving it touched nothing it should not.
//
// The write itself is one column. What matters is everything it deliberately
// does NOT do: it reads no row, recomputes no figure, and clears no review
// state. It is in the operation envelope only so the act is attributed,
// ordered against the sheet's other changes and reversible.

import { NotFoundError } from "../../../lib/errors.ts";
import { overlaySettingsFrom, type OverlayInput, type OverlaySettingsV1 } from "./editor-overlay.ts";
import type { OperationWriteContext } from "./editor-unit-of-work.ts";
import { record } from "./editor-write-helpers.ts";
import type { PreconSessionRow, PreconSheetRow } from "./types.ts";

export interface SetOverlayBody {
  sheetId: string;
  overlay: OverlayInput | null;
  operationId?: string;
}

async function sheetWithSession(
  ctx: OperationWriteContext,
  sheetId: string,
): Promise<{ sheet: PreconSheetRow; session: PreconSessionRow }> {
  const sheet = await ctx.sheets.sheetById(sheetId);
  if (!sheet) throw new NotFoundError("Sheet");
  const session = await ctx.sessions.sessionById(sheet.session_id);
  if (!session) throw new NotFoundError("Preconstruction session");
  return { sheet, session };
}

export async function setOverlayIn(
  ctx: OperationWriteContext,
  sessionId: string,
  body: SetOverlayBody,
  actor: string,
): Promise<OverlaySettingsV1 | null> {
  const target = await sheetWithSession(ctx, body.sheetId);
  if (target.sheet.session_id !== sessionId) throw new NotFoundError("Sheet");
  const before = target.sheet.overlay_settings ?? null;

  const settings =
    body.overlay === null
      ? null
      : overlaySettingsFrom(body.overlay, { target, source: await sheetWithSession(ctx, body.overlay.sourceSheetId) }, actor);

  const updated = await ctx.sheets.setOverlaySettings(body.sheetId, settings);
  await record(
    ctx,
    sessionId,
    null,
    actor,
    settings === null ? "overlay_cleared" : "overlay_set",
    { sheetId: body.sheetId, overlay: before, version: target.sheet.version ?? 1 },
    { sheetId: body.sheetId, overlay: settings, version: updated.version ?? 1 },
    body.operationId,
  );
  return settings;
}
