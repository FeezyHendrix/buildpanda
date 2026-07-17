import type { Knex } from "knex";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { openStoredFile } from "../../../../lib/file-storage.ts";
import { generateId } from "../../../../lib/ids.ts";
import { preconRepository } from "../repository.ts";
import type { MeasuredBoqItem, PreconSheetRow, Segment, SheetKind, TextRun } from "../types.ts";
import { extractSheet, buildSnapIndex } from "./pdf-extract.ts";
import { calibrate } from "./calibrate.ts";
import { clusterRegions, segmentsInRegion } from "./cluster.ts";
import {
  countDoorArcs,
  countTags,
  curvesInRegion,
  geometryFromWallPairs,
  measureRoomAreas,
  measureWalls,
  textsInRegion,
  wallConfidence,
} from "./measure.ts";
import { draftBoq } from "./boq-draft.ts";
import { measureSheetViaVision, VISION_MAX_SHEETS_PER_SESSION } from "./vision-takeoff.ts";
import { findDuplicatePlans, applyFloorRepetition, tagSignature, type PlanFingerprint } from "./fingerprint.ts";
import { buildUpBill, staticBesmmResolver, type BesmmResolver } from "./enrich.ts";
import { besmmRag } from "../../../../lib/besmm-rag.ts";
import { isEmbeddingConfigured } from "../../../../lib/llm.ts";
import { briefsFor } from "./besmm-reference.ts";
import { classifyStructure } from "./classify.ts";
import { readBbs, bbsToItems, readPileSchedule, pileScheduleToItems } from "./structural-schedule.ts";
import { measureCivil, civilToItems } from "./civil-measure.ts";
import { applyOpeningDeductions, applySchedules, looksLikeScheduleSheet, measureDiagramSizes, mergeDiagramSizes, readSchedules, readingOrderLines } from "./schedule.ts";
import { chatJsonValidated, isLlmConfigured } from "../../../../lib/llm.ts";
import { priceRow } from "./price.ts";

const DEFAULT_WALL_HEIGHT_M = 2.7;

function besmmResolverFor(db: Knex): BesmmResolver {
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

export type ProgressFn = (message: string, data?: Record<string, unknown>) => void;

async function withTempFile<T>(storagePath: string, ext: string, fn: (file: string) => Promise<T>): Promise<T> {
  const file = path.join(os.tmpdir(), `${generateId("pcg")}.${ext}`);
  const stream = await openStoredFile(storagePath);
  await pipeline(stream as Readable, createWriteStream(file));
  try {
    return await fn(file);
  } finally {
    await fs.rm(file, { force: true });
  }
}

const SHEET_TITLE_KINDS: [RegExp, SheetKind][] = [
  [/floor\s*plan|ground\s*floor|first\s*floor|typical\s*floor/i, "floor-plan"],
  [/elevation/i, "elevation"],
  [/section/i, "section"],
  [/schedule/i, "schedule"],
  [/detail/i, "detail"],
];

function classifySheet(texts: { str: string }[], hasDoorArcs: boolean, hasRoomLabels: boolean): {
  kind: SheetKind;
  title: string | null;
} {
  const joined = texts.map((t) => t.str);
  let title: string | null = null;
  let kind: SheetKind = "unknown";
  for (const [pattern, k] of SHEET_TITLE_KINDS) {
    const hit = joined.find((s) => pattern.test(s) && s.length < 80);
    if (hit) {
      title = hit;
      kind = k;
      break;
    }
  }
  if (kind === "unknown" && (hasDoorArcs || hasRoomLabels)) kind = "floor-plan";
  return { kind, title };
}

interface SheetMeasurement {
  items: MeasuredBoqItem[];
  fingerprint: PlanFingerprint | null;
}

// One region = one drawing. Measure only floor-plan-looking regions, and only
// the largest one per sheet — repeated plans on a sheet must not multiply
// quantities; the QS duplicates verified items per floor in review instead.
function measureSheetRegions(
  extracted: Awaited<ReturnType<typeof extractSheet>>,
  mmPerPt: number,
  calibrationConfidence: number,
  pageNumber: number,
  sheetLabel: string,
): SheetMeasurement {
  const regions = clusterRegions(extracted);
  const items: MeasuredBoqItem[] = [];
  if (regions.length === 0) return { items, fingerprint: null };

  const primary = regions[0]!;
  const regionSegments = segmentsInRegion(extracted.segments, primary);
  const regionTexts = textsInRegion(extracted.texts, primary);
  const regionCurves = curvesInRegion(extracted.curves, primary);

  const walls = measureWalls(regionSegments, mmPerPt);
  if (walls.centrelineM > 0) {
    const grossM2 = Math.round(walls.centrelineM * DEFAULT_WALL_HEIGHT_M * 100) / 100;
    items.push({
      elementGroup: "Internal and external walls",
      workSection: { code: "F10", title: "BRICK/BLOCK WALLING" },
      specNote: "Sandcrete block walls; cement mortar (1:6); wall height assumed 2.70m pending elevations.",
      code: "F10/125",
      description: "Hollow sandcrete blockwall bedded and jointed in cement and sand mortar (1:6); walls; 225mm thick; skin of hollow walls; laid in stretcher bond",
      unit: "m2",
      qtyGross: grossM2,
      deductions: [],
      qty: grossM2,
      confidence: wallConfidence(walls.pairs.length, calibrationConfidence),
      measurementBasis: `${walls.centrelineM.toFixed(1)}m centreline from ${walls.pairs.length} parallel wall pairs x ${DEFAULT_WALL_HEIGHT_M}m assumed height (${sheetLabel})`,
      geometries: geometryFromWallPairs(walls.pairs),
      pageNumber,
    });
  }

  const doors = countDoorArcs(regionCurves, mmPerPt);
  const tags = countTags(regionTexts);
  const toM = mmPerPt / 1000;
  const fingerprint: PlanFingerprint = {
    pageNumber,
    centrelineM: walls.centrelineM,
    wallPairs: walls.pairs.length,
    widthM: Math.round((primary.maxX - primary.minX) * toM * 10) / 10,
    heightM: Math.round((primary.maxY - primary.minY) * toM * 10) / 10,
    doorArcs: doors.count,
    tagSignature: tagSignature(tags),
  };

  if (tags.doors.size > 0) {
    for (const [tag, occurrences] of [...tags.doors.entries()].sort()) {
      items.push({
        elementGroup: "Doors",
        workSection: { code: "L20", title: "DOORS/SHUTTERS/HATCHES" },
        specNote: "Door types per architect's door schedule.",
        code: "L20",
        description: `Door type ${tag}; as door schedule`,
        unit: "nr",
        qtyGross: occurrences.length,
        deductions: [],
        qty: occurrences.length,
        confidence: "high",
        measurementBasis: `${occurrences.length} "${tag}" tags on ${sheetLabel}${doors.count ? `; ${doors.count} swing arcs on sheet as cross-check` : ""}`,
        geometries: [
          {
            kind: "count",
            vertices: occurrences.map((t) => [t.x, t.y]),
            quantity: occurrences.length,
            unit: "nr",
          },
        ],
        pageNumber,
      });
    }
  } else if (doors.count > 0) {
    items.push({
      elementGroup: "Doors",
      workSection: { code: "L20", title: "DOORS/SHUTTERS/HATCHES" },
      specNote: null,
      code: "L20",
      description: "Doors; type not tagged on plan — confirm against door schedule",
      unit: "nr",
      qtyGross: doors.count,
      deductions: [],
      qty: doors.count,
      confidence: "low",
      measurementBasis: `${doors.count} door-swing arcs (r 600-1200mm) on ${sheetLabel}`,
      geometries: [{ kind: "count", vertices: doors.centres, quantity: doors.count, unit: "nr" }],
      pageNumber,
    });
  }
  for (const [tag, occurrences] of [...tags.windows.entries()].sort()) {
    items.push({
      elementGroup: "Windows",
      workSection: { code: "L11", title: "WINDOWS/ROOFLIGHTS/SCREENS" },
      specNote: "Window types per architect's window schedule.",
      code: "L11",
      description: `Window type ${tag}; as window schedule`,
      unit: "nr",
      qtyGross: occurrences.length,
      deductions: [],
      qty: occurrences.length,
      confidence: "high",
      measurementBasis: `${occurrences.length} "${tag}" tags on ${sheetLabel}`,
      geometries: [
        { kind: "count", vertices: occurrences.map((t) => [t.x, t.y]), quantity: occurrences.length, unit: "nr" },
      ],
      pageNumber,
    });
  }

  const rooms = measureRoomAreas(regionSegments, extracted.texts, primary, mmPerPt);
  const totalFloorM2 = Math.round(rooms.reduce((s, r) => s + r.areaM2, 0) * 100) / 100;
  if (rooms.length > 0) {
    items.push({
      elementGroup: "Floor finishings",
      workSection: { code: "M10", title: "SAND CEMENT SCREEDS/TOPPINGS" },
      specNote: "Floor areas measured room-by-room from wall enclosure; finishes to specification.",
      code: "M10",
      description: `Cement/sand screeded beds to floors (${rooms.length} rooms: ${rooms
        .slice(0, 6)
        .map((r) => r.name)
        .join(", ")}${rooms.length > 6 ? "…" : ""})`,
      unit: "m2",
      qtyGross: totalFloorM2,
      deductions: [],
      qty: totalFloorM2,
      confidence: "low",
      measurementBasis: `Flood-fill room areas from ${rooms.length} room labels on ${sheetLabel}`,
      geometries: rooms.map((r) => ({
        kind: "count" as const,
        vertices: [r.seed],
        quantity: r.areaM2,
        unit: "m2",
      })),
      pageNumber,
    });
  }

  for (const item of items) item.scope = "per-floor";
  return { items, fingerprint };
}

export async function generateForSession(
  db: Knex,
  sessionId: string,
  progress: ProgressFn = () => {},
): Promise<void> {
  const repo = preconRepository(db);
  const sheets = await repo.sheetsBySession(sessionId);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const allItems: MeasuredBoqItem[] = [];
  const visionBudget = { remainingSheets: VISION_MAX_SHEETS_PER_SESSION };
  const pageFingerprints: PlanFingerprint[] = [];
  const scheduleSheets: { pageNumber: number; lines: string[] }[] = [];
  const scheduleTexts: TextRun[] = [];
  const sheetIdByPage = new Map<number, string>();
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
        progress(`Reading ${placeholder.file_name} (${doc.numPages} pages)`, { pages: doc.numPages });

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
                allItems.push(...visionItems);
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
              const measured = measureSheetRegions(extracted, calibration.mmPerPt, calibration.confidence, globalPage, sheetLabel);
              if (measured.fingerprint) pageFingerprints.push(measured.fingerprint);
              // low calibration confidence demotes everything on the sheet
              const demoted =
                calibration.confidence < 0.7
                  ? measured.items.map((i) => ({ ...i, confidence: "low" as const }))
                  : measured.items;
              allItems.push(...demoted);
              progress(`Measured ${sheetLabel}: ${demoted.length} items at 1:${Math.round(calibration.mmPerPt / 0.3528)}`, {
                sheetId,
                items: demoted.length,
              });
            } else if (!calibration) {
              progress(`No reliable scale on ${sheetLabel}; sheet available for manual takeoff`, { sheetId });
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
      progress(`Floors on pages ${group.members.join(", ")} are identical — measured once x ${group.groupSize}`);
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
    }
  }

  let billItems: MeasuredBoqItem[] = [...merged.values()];

  for (const sheet of scheduleSheets) {
    const reading = readBbs(sheet.lines);
    if (reading) {
      const rebarItems = bbsToItems(reading, sheet.pageNumber);
      if (rebarItems.length > 0) {
        billItems.push(...rebarItems);
        progress(`Read bar bending schedule on page ${sheet.pageNumber}: ${reading.totalTonnes.toFixed(2)} t reinforcement`);
      }
    }
    const piles = readPileSchedule(sheet.lines);
    if (piles) {
      const pileItems = pileScheduleToItems(piles, sheet.pageNumber);
      if (pileItems.length > 0) {
        billItems.push(...pileItems);
        const totalPiles = Object.values(piles.byDiameter).reduce((s, d) => s + d.number, 0);
        progress(`Read pile schedule on page ${sheet.pageNumber}: ${totalPiles} piles`);
      }
    }
  }

  // Schedule pass: the architect's door/window schedule tables are the
  // authoritative counts and carry sizes/materials; the tag census becomes
  // the cross-check and disagreements are flagged for review.
  let scheduleSummary = "";
  if (isLlmConfigured() && scheduleSheets.length > 0) {
    progress(`Reading ${scheduleSheets.length} schedule sheet(s)`);
    try {
      let schedules = await readSchedules(scheduleSheets, async (messages, schema) =>
        chatJsonValidated(messages, schema),
      );
      if (schedules) {
        // deterministic diagram dimensions beat transcribed table cells
        const diagramSizes = measureDiagramSizes(scheduleTexts);
        if (diagramSizes.size > 0) {
          schedules = mergeDiagramSizes(schedules, diagramSizes);
          progress(`Measured ${diagramSizes.size} type elevations on the schedule sheet`);
        }
        billItems = applySchedules(billItems, schedules);
        billItems = applyOpeningDeductions(billItems, schedules);
        const specs = [...schedules.windows, ...schedules.doors]
          .filter((e) => e.material || e.remarks)
          .map((e) => `${e.type}: ${[e.material, e.remarks].filter(Boolean).join(", ")}`)
          .slice(0, 20);
        scheduleSummary = specs.length > 0 ? ` Schedule specs: ${specs.join("; ")}.` : "";
        progress(`Applied schedules: ${schedules.windows.length} window types, ${schedules.doors.length} door types`);
      }
    } catch {
      progress("Schedule sheets found but could not be read; tag census stands");
    }
  }

  const structure = classifyStructure({ sheetTitles: classifyTitles, sheets: classifySheets, text: classifyText.join(" \n ") });
  await repo.updateSessionStructure(sessionId, structure);
  progress(
    `Detected structure: ${structure.structureClass}${structure.buildingType ? ` (${structure.buildingType})` : ""}`,
    { structure },
  );

  const CIVIL_CLASSES = new Set(["road", "airport", "bridge", "infrastructure"]);
  if (CIVIL_CLASSES.has(structure.structureClass) && civilSheets.length > 0) {
    const best = civilSheets.reduce((a, b) => (b.segments.length > a.segments.length ? b : a));
    const civilItems = civilToItems(measureCivil(best.segments, best.mmPerPt), best.pageNumber);
    if (civilItems.length > 0) {
      billItems.push(...civilItems);
      progress(`Measured civil surface geometry on page ${best.pageNumber}: ${civilItems.length} anchors`);
    }
  }

  // Build-up stage: parallel per-element QS agents expand the measured
  // anchors into a BESMM-granular bill. Quantities stay engine-computed —
  // agents only name anchors or formulas; provisional items carry none.
  if (isLlmConfigured() && billItems.length > 0) {
    progress("Building up the bill with parallel QS agents");
    const sheetContext = `${sheets.length} sheets; measured anchors come from floor plans only (no structural, roof or MEP drawings).${scheduleSummary}`;
    const resolveBesmm = besmmResolverFor(db);
    const outcome = await buildUpBill(
      billItems,
      sheetContext,
      async (messages, schema) => chatJsonValidated(messages, schema),
      (message) => progress(message),
      briefsFor(structure.structureClass),
      resolveBesmm,
    );
    const failed = outcome.agentResults.filter((r) => r.failed).map((r) => r.element);
    if (failed.length > 0) progress(`Elements left for manual billing: ${failed.join(", ")}`);
    // enrichment replaces the bare wall/floor lines with its fuller sections,
    // but keeps measured geometry rows: merge by code+description, measured wins
    const measuredKeys = new Set(billItems.map((i) => `${i.code}|${i.description}`));
    billItems = [...billItems, ...outcome.items.filter((i) => !measuredKeys.has(`${i.code}|${i.description}`))];
  }

  const { bills, rows, geometries } = draftBoq(sessionId, billItems, sheetIdByPage);

  // price measured items against the org's most recent rate card
  const orgId = await repo.orgIdForSession(sessionId);
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
      if (priced > 0) progress(`Priced ${priced} items against "${card.name}"`);
    }
  }

  await repo.insertBills(bills);
  await repo.insertBoqRows(rows);
  await repo.insertGeometries(geometries);
  progress(`Draft BOQ ready: ${rows.filter((r) => r.row_type === "item").length} items across ${bills.length} bills`, {
    rows: rows.length,
  });
}
