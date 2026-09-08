import type { Knex } from "knex";
import { generateId } from "../../../../lib/ids.ts";
import { preconRepository } from "../repository.ts";
import type { MeasuredBoqItem, PreconSheetRow, Segment, SheetKind, TextRun, PreconPhase, TakeoffScope } from "../types.ts";
import { classifySheet, measureSheetRegions, regionShareOfSheet, withTempFile } from "./measure-sheet.ts";

export { regionShareOfSheet };
import { FULL_TAKEOFF_SCOPE, MEASURED_AREAS_GROUP } from "../types.ts";
import { extractSheet, buildSnapIndex } from "./pdf-extract.ts";
import { calibrate } from "./calibrate.ts";
import { countDoorArcs } from "./measure.ts";
import { draftBoq } from "./boq-draft.ts";
import { measureSheetViaVision, VISION_MAX_SHEETS_PER_SESSION } from "./vision-takeoff.ts";
import { findDuplicatePlans, applyFloorRepetition, type PlanFingerprint } from "./fingerprint.ts";
import { buildUpBill, staticBesmmResolver, type BesmmResolver } from "./enrich.ts";
import { besmmRag } from "../../../../lib/besmm-rag.ts";
import { isEmbeddingConfigured } from "../../../../lib/llm.ts";
import { briefsFor } from "./besmm-reference.ts";
import { classifyStructure } from "./classify.ts";
import { readBbs, bbsToItems, provisionalRebarItem, readPileSchedule, pileScheduleToItems } from "./structural-schedule.ts";
import { measureCivil, civilToItems } from "./civil-measure.ts";
import { applyOpeningDeductions, applySchedules, looksLikeScheduleSheet, measureDiagramSizes, mergeDiagramSizes, readSchedules, readingOrderLines } from "./schedule.ts";
import { chatJsonValidated, isLlmConfigured } from "../../../../lib/llm.ts";
import { priceRow } from "./price.ts";

// PDF take-off. The sibling dwg-takeoff module reads DWG vectors natively and
// stays fully deterministic; PDFs lose that fidelity, so this pipeline adds a
// raster/vision fallback, schedule reading and BESMM enrichment on top of the
// same vector-first measurement. Quantities still come from geometry only --
// the LLM shapes descriptions and rules, never numbers.

export function besmmResolverFor(db: Knex): BesmmResolver {
  if (!isEmbeddingConfigured()) return staticBesmmResolver;
  const rag = besmmRag(db);
  return async (brief) => {
    try {
      const query = brief.retrievalQuery ?? `${brief.element}. ${brief.guidance}`;
      const matches = await rag.search(query, { sectionCodes: brief.sectionCodes, limit: 6 });
      if (matches.length === 0) return staticBesmmResolver(brief);
      const pages = matches.map((m) => m.pageFrom).join(", ");
      const body = matches.map((m) => `[p.${m.pageFrom}] ${m.content.trim()}`).join("\n\n");
      return [
        `<besmm_reference source="BESMM4 NIQS 4th Ed 2015" pages="${pages}">`,
        body,
        `</besmm_reference>`,
        "BESMM REFERENCE RULES:",
        "- Use these clauses to shape measurement decisions and produce BESMM-conformant description text.",
        "- PARAPHRASE. Never quote the reference text verbatim into a bill item description.",
        "- The billing template's unit is AUTHORITATIVE. If the reference implies a different unit, keep the template's unit.",
        "- The reference is OCR-extracted and table columns may be interleaved. Only rely on a threshold or number when it appears clearly and un-fragmented; otherwise ignore it.",
        `- For each item you rely on the reference for, set refPages to the page numbers you used, from this list only: ${pages}. Never invent page numbers.`,
      ].join("\n");
    } catch {
      return staticBesmmResolver(brief);
    }
  };
}

export type ProgressFn = (phase: PreconPhase, message: string, data?: Record<string, unknown>) => void | Promise<void>;

export async function generateForSession(
  db: Knex,
  sessionId: string,
  progress: ProgressFn = () => {},
): Promise<void> {
  const repo = preconRepository(db);
  const session = await repo.sessionById(sessionId);
  const scope: TakeoffScope = session?.scope ?? FULL_TAKEOFF_SCOPE;
  const areasOnly = scope.kind === "areas";
  const sheets = await repo.sheetsBySession(sessionId);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const allItems: MeasuredBoqItem[] = [];
  const visionBudget = { remainingSheets: VISION_MAX_SHEETS_PER_SESSION };
  const pageFingerprints: PlanFingerprint[] = [];
  const scheduleSheets: { pageNumber: number; lines: string[] }[] = [];
  const scheduleTexts: TextRun[] = [];
  const sheetIdByPage = new Map<number, string>();
  const sheetCodeByPage = new Map<number, string>();
  const classifyTitles: string[] = [];
  const classifySheets: { kind: SheetKind; title: string }[] = [];
  const classifyText: string[] = [];
  const civilSheets: { segments: Segment[]; mmPerPt: number; pageNumber: number }[] = [];
  let nextPageNumber = 1;

  for (const placeholder of sheets) {
    if (/\.dwg$/i.test(placeholder.file_name)) {
      // DWG stays on the existing takeoff engine path; mark for manual pass here.
      await repo.updateSheetStatus(placeholder.id, "unmeasurable", "DWG measurement runs via automated take-off");
      continue;
    }
    try {
      await withTempFile(placeholder.storage_path, "pdf", async (file) => {
        const doc = await pdfjs.getDocument({ url: file, useSystemFonts: true }).promise;
        await progress("reading", `Reading ${placeholder.file_name} (${doc.numPages} pages)`, { pages: doc.numPages });

        for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
          const globalPage = nextPageNumber++;
          // first placeholder row is reused for page 1; further pages get their own rows
          const sheetRow: Omit<PreconSheetRow, "created_at" | "updated_at"> | null =
            pageNo === 1
              ? null
              : {
                  id: generateId("pcsh"),
                  session_id: sessionId,
                  file_name: placeholder.file_name,
                  storage_path: placeholder.storage_path,
                  page_number: globalPage,
                  code: null,
                  title: null,
                  kind: "unknown",
                  status: "pending",
                  scale_mm_per_pt: null,
                  scale_confidence: null,
                  dim_unit: null,
                  snap_index: null,
                  error: null,
                };
          if (sheetRow) await repo.insertSheets([sheetRow]);
          const sheetId = sheetRow?.id ?? placeholder.id;
          sheetIdByPage.set(globalPage, sheetId);

          try {
            const page = await doc.getPage(pageNo);
            const extracted = await extractSheet(page as never, pdfjs.OPS as never);
            if (extracted.segments.length < 100) {
              const visionItems = await measureSheetViaVision(
                {
                  storagePath: placeholder.storage_path,
                  pageNumber: pageNo,
                  globalPage,
                  sheetLabel: `${placeholder.file_name} p${pageNo}`,
                },
                visionBudget,
              );
              if (visionItems && visionItems.length > 0) {
                allItems.push(...visionItems.map((i) => ({ ...i, confidenceReason: i.confidenceReason ?? "vision" })));
                sheetCodeByPage.set(globalPage, `SHT-${String(globalPage).padStart(2, "0")}`);
                await repo.updateSheet(sheetId, {
                  code: `SHT-${String(globalPage).padStart(2, "0")}`,
                  title: placeholder.file_name,
                  kind: "floor-plan",
                  status: "measured",
                  page_number: globalPage,
                });
              } else {
                await repo.updateSheet(sheetId, {
                  status: "unmeasurable",
                  error: "No vector content — likely a scanned/raster drawing; use manual takeoff",
                  page_number: globalPage,
                });
              }
              continue;
            }
            if (looksLikeScheduleSheet(extracted.texts)) {
              scheduleSheets.push({ pageNumber: globalPage, lines: readingOrderLines(extracted.texts) });
              scheduleTexts.push(...extracted.texts);
            }
            const calibration = calibrate(extracted.texts, extracted.segments);
            const doorProbe = countDoorArcs(extracted.curves, calibration?.mmPerPt ?? 17.68);
            const { kind, title } = classifySheet(
              extracted.texts,
              doorProbe.count > 0,
              /bed\s*room|kitchen|living|lounge/i.test(extracted.texts.map((t) => t.str).join(" ")),
            );
            if (title) {
              classifyTitles.push(title);
              classifySheets.push({ kind, title });
            }
            if (classifyText.length < 40) classifyText.push(extracted.texts.map((t) => t.str).join(" ").slice(0, 2000));
            const sheetLabel = `${placeholder.file_name} p${pageNo}`;
            const code = `SHT-${String(globalPage).padStart(2, "0")}`;
            sheetCodeByPage.set(globalPage, code);

            await repo.updateSheet(sheetId, {
              code,
              title,
              kind,
              status: "measured",
              page_number: globalPage,
              scale_mm_per_pt: calibration?.mmPerPt ?? null,
              scale_confidence: calibration?.confidence ?? null,
              dim_unit: calibration?.dimUnit ?? null,
              snap_index: buildSnapIndex(extracted.segments),
            });

            if (calibration && extracted.segments.length >= 20) {
              civilSheets.push({ segments: extracted.segments, mmPerPt: calibration.mmPerPt, pageNumber: globalPage });
            }
            if (calibration && kind === "floor-plan") {
              const measured = measureSheetRegions(extracted, calibration.mmPerPt, calibration.confidence, globalPage, sheetLabel, areasOnly);
              if (measured.fingerprint) pageFingerprints.push(measured.fingerprint);
              // low calibration confidence demotes everything on the sheet
              const demoted =
                calibration.confidence < 0.7
                  ? measured.items.map((i) => ({ ...i, confidence: "low" as const, confidenceReason: "scale" }))
                  : measured.items;
              allItems.push(...demoted);
              await progress("reading", `Measured ${sheetLabel}: ${demoted.length} items at 1:${Math.round(calibration.mmPerPt / 0.3528)}`, {
                sheetId,
                items: demoted.length,
              });
            } else if (!calibration) {
              await progress("reading", `No reliable scale on ${sheetLabel}; sheet available for manual takeoff`, { sheetId });
            }
          } catch (pageError) {
            const message = pageError instanceof Error ? pageError.message : "Page measurement failed";
            await repo.updateSheetStatus(sheetId, "unmeasurable", message);
          }
        }
        await doc.cleanup();
      });
    } catch (fileError) {
      const message = fileError instanceof Error ? fileError.message : "File processing failed";
      await repo.updateSheetStatus(placeholder.id, "unmeasurable", message);
    }
  }

  // Repeated-floor handling: identical typical floors are one drawing repeated.
  // Drop the duplicate pages, but MULTIPLY the representative's per-floor items
  // by the group size so the building is not under-counted (measure once x N).
  const dup = findDuplicatePlans(pageFingerprints);
  const dedupedItems = applyFloorRepetition(allItems, dup);
  for (const group of dup.groups.values()) {
    if (group.groupSize > 1) {
      await progress("reading", `Floors on pages ${group.members.join(", ")} are identical — measured once x ${group.groupSize}`);
    }
  }

  // Duplicate item descriptions across floor-plan sheets collapse into one row
  // per description with quantities summed — separate floors add up; repeated
  // views of the same floor are avoided upstream by measuring one region/sheet.
  const merged = new Map<string, MeasuredBoqItem>();
  for (const item of dedupedItems) {
    const key = `${item.code}|${item.description}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item, mergedPages: [item.pageNumber] } as MeasuredBoqItem & { mergedPages: number[] });
    } else {
      existing.qtyGross = Math.round((existing.qtyGross + item.qtyGross) * 100) / 100;
      existing.qty = Math.round((existing.qty + item.qty) * 100) / 100;
      (existing as MeasuredBoqItem & { mergedPages: number[] }).mergedPages.push(item.pageNumber);
      existing.geometries.push(...item.geometries.map((g) => ({ ...g, pageNumber: g.pageNumber ?? item.pageNumber })));
      if (item.confidence === "low") existing.confidence = "low";
    }
  }
  for (const item of merged.values()) {
    const pages = (item as MeasuredBoqItem & { mergedPages: number[] }).mergedPages;
    if (pages.length > 1) {
      item.measurementBasis = `${item.measurementBasis.split(" (")[0]} — summed across ${pages.length} sheets (pages ${pages.join(", ")}); repeated floor views may double-count, review per sheet`;
      item.confidence = "low";
      item.confidenceReason = "two sheets summed";
    }
  }

  let billItems: MeasuredBoqItem[] = [...merged.values()];
  // An areas-only run stops here: no schedules, no build-up, no pricing.
  if (areasOnly) billItems = billItems.filter((item) => item.elementGroup === MEASURED_AREAS_GROUP);

  for (const sheet of areasOnly ? [] : scheduleSheets) {
    const reading = readBbs(sheet.lines);
    if (reading) {
      if (reading.unreadable) {
        billItems.push(provisionalRebarItem(sheet.pageNumber));
        await progress("schedules", `Bar bending schedule on page ${sheet.pageNumber} could not be read reliably — rebar left provisional`);
      } else {
        const rebarItems = bbsToItems(reading, sheet.pageNumber);
        if (rebarItems.length > 0) {
          billItems.push(...rebarItems);
          await progress("schedules", `Read bar bending schedule on page ${sheet.pageNumber}: ${reading.totalTonnes.toFixed(2)} t reinforcement`);
        }
      }
    }
    const piles = readPileSchedule(sheet.lines);
    if (piles) {
      const pileItems = pileScheduleToItems(piles, sheet.pageNumber);
      if (pileItems.length > 0) {
        billItems.push(...pileItems);
        const totalPiles = Object.values(piles.byDiameter).reduce((s, d) => s + d.number, 0);
        await progress("schedules", `Read pile schedule on page ${sheet.pageNumber}: ${totalPiles} piles`);
      }
    }
  }

  // Schedule pass: the architect's door/window schedule tables are the
  // authoritative counts and carry sizes/materials; the tag census becomes
  // the cross-check and disagreements are flagged for review.
  let scheduleSummary = "";
  if (!areasOnly && isLlmConfigured() && scheduleSheets.length > 0) {
    await progress("schedules", `Reading ${scheduleSheets.length} schedule sheet(s)`);
    try {
      let schedules = await readSchedules(scheduleSheets, async (messages, schema) =>
        chatJsonValidated(messages, schema),
      );
      if (schedules) {
        // deterministic diagram dimensions beat transcribed table cells
        const diagramSizes = measureDiagramSizes(scheduleTexts);
        if (diagramSizes.size > 0) {
          schedules = mergeDiagramSizes(schedules, diagramSizes);
          await progress("schedules", `Measured ${diagramSizes.size} type elevations on the schedule sheet`);
        }
        billItems = applySchedules(billItems, schedules);
        billItems = applyOpeningDeductions(billItems, schedules);
        const specs = [...schedules.windows, ...schedules.doors]
          .filter((e) => e.material || e.remarks)
          .map((e) => `${e.type}: ${[e.material, e.remarks].filter(Boolean).join(", ")}`)
          .slice(0, 20);
        scheduleSummary = specs.length > 0 ? ` Schedule specs: ${specs.join("; ")}.` : "";
        await progress("schedules", `Applied schedules: ${schedules.windows.length} window types, ${schedules.doors.length} door types`);
      }
    } catch {
      await progress("schedules", "Schedule sheets found but could not be read; tag census stands");
    }
  }

  const structure = classifyStructure({ sheetTitles: classifyTitles, sheets: classifySheets, text: classifyText.join(" \n ") });
  await repo.updateSessionStructure(sessionId, structure);
  await progress("structure", 
    `Detected structure: ${structure.structureClass}${structure.buildingType ? ` (${structure.buildingType})` : ""}`,
    { structure },
  );

  const CIVIL_CLASSES = new Set(["road", "airport", "bridge", "infrastructure"]);
  if (!areasOnly && CIVIL_CLASSES.has(structure.structureClass) && civilSheets.length > 0) {
    const best = civilSheets.reduce((a, b) => (b.segments.length > a.segments.length ? b : a));
    const civilItems = civilToItems(measureCivil(best.segments, best.mmPerPt), best.pageNumber);
    if (civilItems.length > 0) {
      billItems.push(...civilItems);
      await progress("structure", `Measured civil surface geometry on page ${best.pageNumber}: ${civilItems.length} anchors`);
    }
  }

  // Build-up stage: parallel per-element QS agents expand the measured
  // anchors into a BESMM-granular bill. Quantities stay engine-computed —
  // agents only name anchors or formulas; provisional items carry none.
  const briefs = briefsFor(structure.structureClass, { storeys: structure.storeys, foundationType: structure.foundationType })
    .filter((brief) => scope.kind !== "sections" || scope.elements.includes(brief.element));
  if (!areasOnly && isLlmConfigured() && billItems.length > 0 && briefs.length > 0) {
    await progress(
      "building",
      scope.kind === "sections"
        ? `Building up ${scope.elements.join(", ")} with QS agents`
        : "Building up the bill with parallel QS agents",
    );
    const sheetContext = `${sheets.length} sheets; measured anchors come from floor plans only (no structural, roof or MEP drawings).${scheduleSummary}`;
    const resolveBesmm = besmmResolverFor(db);
    const outcome = await buildUpBill(
      billItems,
      sheetContext,
      async (messages, schema) => chatJsonValidated(messages, schema),
      (message) => void progress("building", message),
      briefs,
      resolveBesmm,
    );
    const failed = outcome.agentResults.filter((r) => r.failed).map((r) => r.element);
    if (failed.length > 0) await progress("building", `Elements left for manual billing: ${failed.join(", ")}`);
    // enrichment replaces the bare wall/floor lines with its fuller sections,
    // but keeps measured geometry rows: merge by code+description, measured wins
    const measuredKeys = new Set(billItems.map((i) => `${i.code}|${i.description}`));
    billItems = [...billItems, ...outcome.items.filter((i) => !measuredKeys.has(`${i.code}|${i.description}`))];
  }
  // Sections runs keep the measured anchors for the agents above but bill
  // only the elements that were asked for.
  if (scope.kind === "sections") {
    const wanted = new Set(scope.elements);
    const before = billItems.length;
    billItems = billItems.filter((item) => wanted.has(item.elementGroup));
    await progress("building", `Kept ${billItems.length} of ${before} measured lines for ${scope.elements.join(", ")}`);
  }

  const { bills, rows, geometries } = draftBoq(sessionId, billItems, sheetIdByPage, sheetCodeByPage);

  // price measured items against the org's most recent rate card
  const orgId = areasOnly ? null : await repo.orgIdForSession(sessionId);
  if (orgId) {
    const [card] = await repo.rateCardsByOrg(orgId);
    if (card) {
      const rates = await repo.ratesByCard(card.id);
      let priced = 0;
      for (const row of rows) {
        if (row.row_type !== "item" && row.row_type !== "provisional_sum") continue;
        const patch = priceRow(row, rates, card.name);
        if (patch) {
          row.rate = patch.rate;
          row.amount = patch.amount;
          row.rate_source = patch.rate_source;
          priced++;
        }
      }
      if (priced > 0) await progress("pricing", `Priced ${priced} items against "${card.name}"`);
    }
  }

  await repo.insertBills(bills);
  await repo.insertBoqRows(rows);
  await repo.insertGeometries(geometries);
  const itemCount = rows.filter((r) => r.row_type === "item").length;
  await progress(
    "draft",
    areasOnly
      ? `Measured areas ready: ${itemCount} spaces across ${bills.length} sheets`
      : `Draft BOQ ready: ${itemCount} items across ${bills.length} bills`,
    { rows: rows.length },
  );
}
