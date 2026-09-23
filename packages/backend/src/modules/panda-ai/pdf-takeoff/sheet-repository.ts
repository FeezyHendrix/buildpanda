import type { OverlaySettingsV1 } from "./editor-overlay.ts";
import type { GeoSummary } from "../geometry/types.ts";
import type { Knex } from "knex";
import { NotFoundError } from "../../../lib/errors.ts";
import type { PreconSheetRow, SheetCalibrationPatch, SheetRegisterPatch, SheetStatus, SheetViewport } from "./types.ts";

export type PreconSheetRepository = ReturnType<typeof preconSheetRepository>;

export function preconSheetRepository(db: Knex) {
  return {
    updateSheetGeoSummary: (id: string, summary: GeoSummary) =>
      db<PreconSheetRow>("precon_sheets")
        .where({ id })
        .update({ geo_summary: db.raw("?::jsonb", [JSON.stringify(summary)]) as never, updated_at: db.fn.now() }),

    insertSheets: (rows: Omit<PreconSheetRow, "created_at" | "updated_at">[]) =>
      rows.length
        ? db<PreconSheetRow>("precon_sheets").insert(
            rows.map((r) => ({ ...r, bounds: (r.bounds ? JSON.stringify(r.bounds) : null) as never })),
          )
        : Promise.resolve(),
    // A re-run redraws the register, but a sheet id is named by everything a
    // person put on that drawing: measurements cascade from it, pinned
    // comments cascade from it. Dropping every sheet would take the evidence
    // with it, so a re-run may only delete the sheets nothing survives on.
    deleteSheetsBySessionExcept: (sessionId: string, keepIds: string[]) =>
      db("precon_sheets")
        .where({ session_id: sessionId })
        .modify((q) => {
          if (keepIds.length) q.whereNotIn("id", keepIds);
        })
        .delete(),

    /**
     * The sheets of this session something still stands on: a live measurement
     * (a tombstoned one was already withdrawn) or any pinned comment at all —
     * a resolved or withdrawn pin is hidden, never erased, and a CASCADE would
     * erase it. Read *after* the re-run has pruned its own drafts, so
     * "surviving" means what is left, not what was there before.
     */
    sheetsWithSurvivingEvidence: async (sessionId: string): Promise<string[]> => {
      const sheetIds = () => db("precon_sheets").select("id").where({ session_id: sessionId });
      const [measured, pinned] = await Promise.all([
        db("precon_geometries")
          .whereIn("sheet_id", sheetIds())
          .whereNull("deleted_at")
          .distinct<{ sheet_id: string }[]>("sheet_id"),
        db("drawing_markups")
          .whereIn("precon_sheet_id", sheetIds())
          .distinct<{ precon_sheet_id: string | null }[]>("precon_sheet_id"),
      ]);
      const ids = new Set<string>();
      for (const row of measured) ids.add(row.sheet_id);
      for (const row of pinned) if (row.precon_sheet_id) ids.add(row.precon_sheet_id);
      return [...ids];
    },

    // The register entry rewritten onto a sheet a re-run may not delete: same
    // id, new reading of the drawing, so the measurements and pins anchored to
    // it still point at the sheet they were made on.
    restateSheet: (id: string, patch: SheetRegisterPatch) =>
      db<PreconSheetRow>("precon_sheets")
        .where({ id })
        .update({
          ...patch,
          bounds: (patch.bounds === undefined || patch.bounds === null ? patch.bounds : JSON.stringify(patch.bounds)) as never,
          updated_at: db.fn.now(),
        }),
    sheetsBySession: (sessionId: string) =>
      db<PreconSheetRow>("precon_sheets").where({ session_id: sessionId }).orderBy("page_number", "asc"),
    sheetById: (id: string) => db<PreconSheetRow>("precon_sheets").where({ id }).first(),
    sheetVersionsByIds: (ids: string[]): Promise<{ id: string; version: number | null }[]> =>
      ids.length
        ? db<PreconSheetRow>("precon_sheets").whereIn("id", ids).select("id", "version")
        : Promise.resolve([]),
    updateSheet: (
      id: string,
      patch: Partial<
        Pick<
          PreconSheetRow,
          | "code"
          | "title"
          | "kind"
          | "status"
          | "page_number"
          | "scale_mm_per_pt"
          | "scale_confidence"
          | "dim_unit"
          | "snap_index"
          | "viewports"
          | "error"
        >
      >,
    ) =>
      db<PreconSheetRow>("precon_sheets")
        .where({ id })
        .update({
          ...patch,
          snap_index: patch.snap_index === undefined ? undefined : (JSON.stringify(patch.snap_index) as never),
          viewports: patch.viewports === undefined ? undefined : (JSON.stringify(patch.viewports) as never),
          updated_at: db.fn.now(),
        }),
    // A re-calibration moves the sheet version with the scale, in one statement:
    // a measurement pins the version its figure was true for, so a scale that
    // landed without a version bump would leave stale figures looking current.
    applyCalibration: async (id: string, patch: SheetCalibrationPatch): Promise<PreconSheetRow> => {
      const rows = await db<PreconSheetRow>("precon_sheets")
        .where({ id })
        .update(
          {
            scale_mm_per_pt: patch.scaleMmPerPt,
            scale_confidence: 1,
            error: null,
            calibration: (patch.calibration === null ? null : JSON.stringify(patch.calibration)) as never,
            version: db.raw("version + 1") as never,
            updated_at: db.fn.now(),
          },
          "*",
        );
      const updated = (rows as PreconSheetRow[])[0];
      if (!updated) throw new NotFoundError("Sheet");
      return updated;
    },

    replaceViewports: async (id: string, viewports: SheetViewport[]): Promise<PreconSheetRow> => {
      const rows = await db<PreconSheetRow>("precon_sheets")
        .where({ id })
        .update(
          {
            viewports: JSON.stringify(viewports) as never,
            version: db.raw("version + 1") as never,
            updated_at: db.fn.now(),
          },
          "*",
        );
      const updated = (rows as PreconSheetRow[])[0];
      if (!updated) throw new NotFoundError("Sheet");
      return updated;
    },

    // An alignment is a record of how two revisions were compared, so it moves
    // the sheet version like any other stated act — and null resets it.
    setOverlaySettings: async (id: string, overlay: OverlaySettingsV1 | null): Promise<PreconSheetRow> => {
      const rows = await db<PreconSheetRow>("precon_sheets")
        .where({ id })
        .update(
          {
            overlay_settings: (overlay === null ? null : JSON.stringify(overlay)) as never,
            version: db.raw("version + 1") as never,
            updated_at: db.fn.now(),
          },
          "*",
        );
      const updated = (rows as PreconSheetRow[])[0];
      if (!updated) throw new NotFoundError("Sheet");
      return updated;
    },

    updateSheetStatus: (id: string, status: SheetStatus, error?: string | null) =>
      db<PreconSheetRow>("precon_sheets").where({ id }).update({ status, error: error ?? null, updated_at: db.fn.now() }),
  };
}
