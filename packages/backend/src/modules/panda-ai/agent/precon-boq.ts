// The draft take-off line as Panda AI reads it.
//
// A net quantity on its own hides why the line is worth what it is. A wall area
// is a drawn run × a height, a slab volume an area × a depth, and the gross
// figure is what was actually measured on the drawing. What turns that gross
// into the billed figure is the rest of the basis:
//
//     net = (gross − Σ openings) × typical
//
// taken at a recorded scale, on a recorded revision of the take-off. Reporting
// the tool and the gross alone left the PM's own question unanswerable — 24 m²
// drawn, 2 m² of cut-out, ×2 typical floors, billed 44: without the opening and
// the repeat there is no explaining the 44, and the only other source was the
// `measurement_basis` sentence, which is prose and must never be parsed back.
//
// A line whose measurement was never recorded structurally cannot be
// re-measured or re-factored at all, so that gap is still reported as a fact
// rather than left to look like any other priced line.

import { PRECON_WORKBOOK_DESCRIPTION } from "./precon-workbook.ts";
import { openingFacts } from "../pdf-takeoff/dto.ts";
import { rowBasis } from "../pdf-takeoff/measurement-basis-facts.ts";
import type { DeductionDto } from "../pdf-takeoff/types.ts";
import type { PreconBoqQueryRow, PreconBoqShapeRow } from "./takeoff-repository.ts";

/** The reads `get_precon_boq` needs, so the mapper can be driven without a tool. */
export interface PreconBoqReader {
  preconBoqRows(projectId: string): Promise<PreconBoqQueryRow[]>;
  preconBoqShapes(projectId: string): Promise<PreconBoqShapeRow[]>;
}

export const GET_PRECON_BOQ_DESCRIPTION =
  "Get the draft preconstruction Bill of Quantities measured by Panda AI from uploaded drawings, with the full measurement basis behind every figure, " +
  "plus the estimating workbooks saved on top of it. Returns { lines, workbooks, ... }: `lines` is the bill, `workbooks` is the spreadsheet built over it. " +
  "lines — per line: element group, code, description, quantity (net, as billed), quantityGross (the figure measured on the drawing before openings and repeats), unit, rate, amount, " +
  "review status (ai_generated/needs_review/verified/rejected) and confidence. " +
  "The basis: tool (the measuring tool, if known: length, polyline, area, count, volume, wall_area), heightM and depthM (the height/depth factor behind a wall_area or volume line), " +
  "quantityMode (measured = drawn on the sheet, stated = a figure given in words), " +
  "deductions (each opening netted off, with its label, qty, unit and mode; unitConfirmed false means the unit was assumed, not confirmed) and deductionsTotal, " +
  "typical (× identical floors or areas) and repeatLabels (what the QS named them), " +
  "scales (every scale the line's drawings were taken at — source sheet or viewport, the viewportId, the sheetVersion the figure was true for, and mmPerPt) and measurementCount (how many drawings measure the line; tool and the factors describe the newest), " +
  "assembly (the assembly as it stood when the line was drawn, frozen), " +
  "sourceRevision (which revision of this take-off measured it) and supersededByNewerRevision (true when the drawing has since been re-measured), " +
  "and hasUnknownBasis (true when the line was measured but its basis cannot be resolved, so it needs factor review). " +
  "net = (quantityGross − deductionsTotal) × typical: use those fields to explain a quantity, and never infer a factor, an opening or a scale that is not there. " +
  "Use for questions about the draft/AI-measured BOQ, takeoff quantities from drawings, why a line bills what it does, which measurement tools or scales were used, which lines need factor review, review progress, or draft bid totals. " +
  "The accepted contractual BoQ lives in get_boq_items. " +
  PRECON_WORKBOOK_DESCRIPTION;

const num = (value: string | number | null): number | null => (value === null ? null : Number(value));

export function preconBoqLine(row: PreconBoqQueryRow, definitions: readonly unknown[] = []) {
  const basis = rowBasis({
    definitions,
    deductions: row.deductions,
    typical: row.typical,
    settings: row.measurement_settings,
    measurementBasis: row.measurement_basis,
  });
  return {
    sessionTitle: row.session_title,
    sessionStatus: row.session_status,
    sourceRevision: row.session_revision,
    supersededByNewerRevision: row.session_superseded_by !== null,
    elementGroup: row.element_group,
    code: row.code,
    description: row.description,
    quantity: num(row.qty),
    quantityGross: num(row.qty_gross),
    unit: row.unit,
    rate: num(row.rate),
    amount: num(row.amount),
    reviewStatus: row.status,
    confidence: row.confidence,
    ...basis,
  };
}

export type PreconBoqLine = ReturnType<typeof preconBoqLine>;

/**
 * Every live priced line of the project with its basis attached, in two queries
 * rather than one per line.
 *
 * The drawings sort into two piles. The outlines that MEASURE a line carry its
 * tool and its scales; `source = 'manual'` and `kind <> 'deduction'` is the
 * shipped meaning of "the drawing that produced the figure". The openings carry
 * how each was taken — its mode and the dimensions that were typed — on their
 * own definitions and nowhere else, so they are rejoined to the row's
 * `deductions` exactly as the take-off's own snapshot rejoins them; without it
 * the two read surfaces would describe the same opening differently.
 *
 * A line with no drawing simply has none, which is what an unrecorded basis
 * looks like and is never filled in with a default.
 */
export async function preconBoqLines(reader: PreconBoqReader, projectId: string): Promise<PreconBoqLine[]> {
  const [rows, shapes] = await Promise.all([reader.preconBoqRows(projectId), reader.preconBoqShapes(projectId)]);
  const measuredBy = new Map<string, unknown[]>();
  const openings = new Map<string, Pick<DeductionDto, "mode" | "dimensions">>();
  for (const shape of shapes) {
    if (shape.kind === "deduction") {
      openings.set(shape.id, openingFacts(shape.definition));
      continue;
    }
    if (shape.source !== "manual") continue;
    const existing = measuredBy.get(shape.row_id);
    if (existing) existing.push(shape.definition);
    else measuredBy.set(shape.row_id, [shape.definition]);
  }
  return rows.map((row) =>
    preconBoqLine({ ...row, deductions: withOpeningFacts(row.deductions, openings) }, measuredBy.get(row.id) ?? []),
  );
}

function withOpeningFacts(
  deductions: unknown,
  openings: ReadonlyMap<string, Pick<DeductionDto, "mode" | "dimensions">>,
): unknown {
  if (!Array.isArray(deductions)) return deductions;
  return deductions.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return entry;
    const geometryId = (entry as { geometryId?: unknown }).geometryId;
    if (typeof geometryId !== "string") return entry;
    return { ...entry, ...(openings.get(geometryId) ?? {}) };
  });
}
