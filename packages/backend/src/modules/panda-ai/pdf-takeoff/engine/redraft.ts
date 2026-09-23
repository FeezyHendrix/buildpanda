import type { Knex } from "knex";
import { NotFoundError, BadRequestError } from "../../../../lib/errors.ts";
import { isLlmConfigured } from "../../../../lib/llm.ts";
import { chatLongJsonValidated } from "../../../../lib/llm-long-text.ts";
import { preconRepository, type RerunToken } from "../repository.ts";
import type { MeasuredBoqItem, PreconBoqRowRow } from "../types.ts";
import { FULL_TAKEOFF_SCOPE } from "../types.ts";
import { buildUpBill } from "./enrich.ts";
import { briefsFor } from "./besmm-reference.ts";
import { draftBoq } from "./boq-draft.ts";
import type { ProgressFn } from "./run.ts";
import { besmmResolverFor } from "./besmm-resolver.ts";
import { measuredBillFor } from "./remeasure.ts";

// Measured and verified lines are the anchors the agents build from; the
// engine's own measurement basis travels with them so descriptions stay honest.
function rowToItem(r: PreconBoqRowRow): MeasuredBoqItem {
  return {
    elementGroup: r.element_group ?? "Other",
    workSection: { code: r.code ?? "", title: r.element_group ?? "" },
    specNote: null,
    code: r.code,
    description: r.description,
    unit: r.unit ?? "item",
    qtyGross: Number(r.qty_gross ?? r.qty ?? 0),
    deductions: (r.deductions ?? []).map((d) => ({ label: d.label, qty: d.qty })),
    qty: Number(r.qty ?? 0),
    confidence: r.confidence ?? "high",
    measurementBasis: r.measurement_basis ?? "",
    geometries: [],
    pageNumber: 0,
  };
}

const PRICED = new Set(["item", "provisional_sum"]);

/**
 * Re-run the QS build-up after the structure reading changed. Only the
 * engine's own unverified, un-measured lines are replaced; anything a person
 * verified, measured by hand, or that carries geometry stays exactly as it is.
 */
export async function redraftBill(
  db: Knex,
  sessionId: string,
  progress: ProgressFn = () => {},
  token?: RerunToken,
): Promise<{ lines: number }> {
  if (!isLlmConfigured()) throw new BadRequestError("Panda AI build-up is not configured on this server");
  const repo = preconRepository(db);
  const session = await repo.sessionById(sessionId);
  if (!session) throw new NotFoundError("Preconstruction session");
  const [rows, geometries, sheets] = await Promise.all([
    repo.rowsBySession(sessionId),
    repo.geometriesBySession(sessionId),
    repo.sheetsBySession(sessionId),
  ]);
  const withGeometry = new Set(geometries.map((g) => g.row_id));
  const anchors = rows
    .filter((r) => PRICED.has(r.row_type) && r.status !== "rejected" && (withGeometry.has(r.id) || r.status === "verified"))
    .map(rowToItem);
  const structure = session.structure_context;
  if (!structure) throw new BadRequestError("Set the structure reading before redrafting the bill");
  const scope = session.scope ?? FULL_TAKEOFF_SCOPE;
  const briefs = briefsFor(structure.structureClass, {
    storeys: structure.storeys,
    foundationType: structure.foundationType,
  }).filter((brief) => scope.kind !== "sections" || scope.elements.includes(brief.element));

  await progress("building", `Redrafting ${briefs.length} elements against ${structure.structureClass}${structure.buildingType ? ` (${structure.buildingType})` : ""}`);
  const outcome = await buildUpBill(
    anchors,
    `${sheets.length} sheets; anchors from verified and measured lines only`,
    async (messages, schema) => chatLongJsonValidated(messages, schema),
    (message) => void progress("building", message),
    briefs,
    besmmResolverFor(db),
  );
  const kept = new Set(anchors.map((i) => `${i.code}|${i.description}`));
  const fresh = outcome.items.filter((i) => !kept.has(`${i.code}|${i.description}`));

  // The build-up is back; the rest is destructive and commits as one unit
  // inside the session lock, and only while this is still the current redraft.
  const applyToken = token ?? (await repo.beginRerun(sessionId));
  const applied = await repo.applyRerun(applyToken, async (trx) => {
    const tx = preconRepository(trx);
    // Re-read inside the lock. The model may have taken minutes, and a line
    // priced or corrected in that time is no longer the engine's to replace.
    const [live, drawn, manualEvidence] = await Promise.all([
      tx.rowsBySession(sessionId),
      tx.geometriesBySession(sessionId),
      tx.rowIdsWithManualEvidence(sessionId),
    ]);
    const measured = new Set(drawn.map((g) => g.row_id));
    const keep = new Set(manualEvidence);
    const stale = live.filter(
      (r) =>
        r.origin === "ai" &&
        r.status !== "verified" &&
        PRICED.has(r.row_type) &&
        !measured.has(r.id) &&
        !keep.has(r.id) &&
        r.edited_at === null &&
        r.element_group !== "Preliminaries",
    );
    await tx.deleteRows(stale.map((r) => r.id));

    const bill = await measuredBillFor(tx, sessionId);
    const drafted = draftBoq(sessionId, fresh, new Map());
    const draftedBillId = drafted.bills[1]!.id;
    const start = await tx.nextRowSort(bill.id);
    const inserted = drafted.rows
      .filter((r) => r.bill_id === draftedBillId)
      .map((r, i) => ({ ...r, bill_id: bill.id, sort: start + i }));
    await tx.insertBoqRows(inserted);
    return { inserted: inserted.length, replaced: stale.length };
  });
  await progress(
    "draft",
    `Redrafted ${applied.inserted} lines; ${applied.replaced} unverified lines replaced, verified lines untouched`,
  );
  return { lines: applied.inserted };
}
