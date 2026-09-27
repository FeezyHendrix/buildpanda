// What a re-run of the automated take-off is allowed to throw away.
//
// A re-run redrafts the engine's reading of a drawing. It is not a reset. By
// the time it runs a QS may have corrected a quantity, priced a line, signed
// one off, withdrawn one, measured a shape by hand or pinned a comment on a
// sheet — each of those is a record of a decision made against a revision, and
// a take-off that quietly erased them would be unusable in a dispute. So the
// re-run replaces only what the engine itself drafted and nobody has touched,
// and it rewrites the register onto the sheet ids that are already spoken for
// rather than minting new ones.

import { generateId } from "../../../lib/ids.ts";
import type {
  DwgRegisterSheet,
  DwgTakeoffHandover,
  PreconBoqRowRow,
  PreconSheet,
  PreconSheetRow,
  SheetRegisterPatch,
} from "./types.ts";
import { DIM_UNITS, SHEET_KIND, SHEET_KINDS } from "./types.ts";

type SheetInsert = Omit<PreconSheetRow, "created_at" | "updated_at">;

export interface SheetRestate {
  id: string;
  patch: SheetRegisterPatch;
}

export interface RegisterPlan {
  insert: SheetInsert[];
  restate: SheetRestate[];
  // the engine numbers its own drawings; the session needs the sheet id each became
  idBySourceId: Map<number, string>;
}

export interface RegisterPlanInput {
  sessionId: string;
  fileName: string;
  storagePath: string;
  units: DwgTakeoffHandover["units"];
  sheets: DwgRegisterSheet[];
  sheetsOnly: boolean;
  existing: PreconSheetRow[];
  survivingIds: ReadonlySet<string>;
}

/**
 * Replaceable: the engine wrote the line, nobody has reviewed or edited it,
 * and it is still live. Everything else is preserved — including a tombstone,
 * which is the standing instruction not to reintroduce a withdrawn line, and
 * which a re-run that deleted it would happily bring back.
 */
export function isReplaceableByRerun(row: Pick<PreconBoqRowRow, "origin" | "status" | "deleted_at">): boolean {
  return row.origin === "ai" && row.status === "ai_generated" && (row.deleted_at ?? null) === null;
}

/**
 * The lines a re-run may actually take, which is narrower than
 * `isReplaceableByRerun` can see on its own.
 *
 * That predicate reads the line's own columns, so it judges what was done TO a
 * line. A person's work also lands BESIDE one — an opening cut by hand out of a
 * drafted wall, a redline pinned to a figure that looked wrong — and the line
 * stays `ai_generated` through both. Taking it then destroys the opening and
 * unhooks the question from the answer it was about, which is exactly the
 * evidence a re-run exists not to touch.
 */
export function replaceableRowIds(
  rows: Pick<PreconBoqRowRow, "id" | "origin" | "status" | "deleted_at">[],
  withManualEvidence: ReadonlySet<string>,
): string[] {
  return rows.filter((row) => isReplaceableByRerun(row) && !withManualEvidence.has(row.id)).map((row) => row.id);
}

const registerKey = (fileName: string, pageNumber: number) => `${fileName}\u0000${pageNumber}`;

type RegisterFields = Required<
  Pick<
    PreconSheetRow,
    "page_number" | "code" | "title" | "kind" | "status" | "scale_mm_per_pt" | "scale_confidence" | "dim_unit" | "bounds" | "error"
  >
>;

function registerFields(
  sheet: DwgRegisterSheet,
  pageNumber: number,
  units: RegisterPlanInput["units"],
  sheetsOnly: boolean,
): RegisterFields {
  const drawable = sheetsOnly || sheet.kind === SHEET_KIND.FLOOR_PLAN || sheet.kind === SHEET_KIND.ROOF_PLAN;
  return {
    page_number: pageNumber,
    code: sheet.code,
    title: sheet.title,
    kind: (SHEET_KINDS as readonly string[]).includes(sheet.kind) ? (sheet.kind as PreconSheet["kind"]) : "unknown",
    status: drawable ? "measured" : "unmeasurable",
    scale_mm_per_pt: units.scaleToMm,
    scale_confidence: Math.max(0, 1 - units.errorPct),
    dim_unit: (DIM_UNITS as readonly string[]).includes(units.unit) ? (units.unit as PreconSheet["dimUnit"]) : null,
    bounds: sheet.bounds,
    error: drawable ? null : `${sheet.kind}: read for context, not measured`,
  };
}

/**
 * The register as writes: a drawing whose sheet still carries evidence is
 * restated in place, a drawing whose sheet was pruned is re-inserted under the
 * id it had before (so a bookmark, an export or an audit entry naming that
 * sheet still resolves), and only a genuinely new file/page mints an id.
 */
export function planRegisterSheets(input: RegisterPlanInput): RegisterPlan {
  const priorByKey = new Map(input.existing.map((s) => [registerKey(s.file_name, s.page_number), s] as const));
  const plan: RegisterPlan = { insert: [], restate: [], idBySourceId: new Map() };

  input.sheets.forEach((sheet, index) => {
    const pageNumber = index + 1;
    const prior = priorByKey.get(registerKey(input.fileName, pageNumber));
    const id = prior?.id ?? generateId("pcsh");
    const fields = registerFields(sheet, pageNumber, input.units, input.sheetsOnly);
    plan.idBySourceId.set(sheet.id, id);
    if (prior && input.survivingIds.has(prior.id)) {
      plan.restate.push({ id, patch: fields });
      return;
    }
    plan.insert.push({
      id,
      session_id: input.sessionId,
      file_name: input.fileName,
      storage_path: input.storagePath,
      snap_index: null,
      geo_summary: null,
      ...fields,
    });
  });

  return plan;
}
