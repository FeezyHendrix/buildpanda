import { parseDwgToJson, type DwgDoc } from "./dwg.ts";
import { expandInserts, realHandles } from "./dwg-inserts.ts";
import { attributeSizes, median as medianOf } from "./attributes.ts";
import { inferUnits } from "./units.ts";
import { elementOf, proposeLayerMap } from "./taxonomy.ts";
import { buildRegister } from "./register.ts";
import { countColumns, countDoors, countSanitary, countWindowsOnPlan, doorWidthMm, outlines, stairs, windowGroupsOnElevation, handles, type SheetContext } from "./elements.ts";
import { autoWallSegments, measureWallRuns, storeyHeight, wallItems, wallSegments } from "./walls.ts";
import { measureRooms, statedAreaNote } from "./rooms.ts";
import { annotateWalls, dimensionCheck, perimeterCheck, wallSummary } from "./wall-checks.ts";
import { checkItem } from "./plausibility.ts";
import type { DrawingSummary, LayerMap, MeasuredItem, RegisterSheet, TakeoffResult, WallSummary } from "./types.ts";

export interface TakeoffEngineOptions {
  layerMap?: LayerMap;
}

/**
 * DWG take-off. Parse → units → drawing register → measure every representative
 * drawing → multiply repeated floors → plausibility. No LLM is involved; every
 * quantity names the handles it was computed from and the method that checked it.
 */
export async function runDwgTakeoff(dwgPath: string, opts: TakeoffEngineOptions = {}): Promise<TakeoffResult> {
  const doc = await parseDwgToJson(dwgPath);
  return measureDoc(doc, opts);
}

// The reading every pass starts from: blocks expanded, units inferred with the
// door-width cross-check, layers mapped, and the drawing register built.
function readDoc(raw: DwgDoc, opts: TakeoffEngineOptions) {
  const notes: string[] = [];
  // block references become the geometry they place, so a handed flat or a
  // door symbol is measured like anything drawn in place
  const expansion = expandInserts(raw);
  const doc = expansion.doc;
  if (expansion.expanded) notes.push(`${expansion.inserts} block references expanded into ${expansion.expanded} entities.`);
  if (expansion.skipped.length) notes.push(`Blocks not expanded: ${expansion.skipped.join(", ")}.`);
  // a first pass with a provisional map gives units their door-width cross-check
  const provisional = opts.layerMap ?? proposeLayerMap(doc, 1).map;
  const provisionalUnits = inferUnits(doc);
  const doorWidths = doorLeafWidths(doc, provisional, provisionalUnits.scaleToMm);
  const units = inferUnits(doc, doorWidths);
  const layerMap = opts.layerMap ?? proposeLayerMap(doc, units.scaleToMm).map;
  const sheets = buildRegister(doc, units, layerMap);
  notes.push(units.note);
  return { notes, expansion, doc, units, layerMap, sheets };
}

/**
 * The register without the measurement: a take-off measured by hand needs the
 * drawings, their windows into the model space and the units, and no lines.
 */
export function registerDoc(raw: DwgDoc, opts: TakeoffEngineOptions = {}): TakeoffResult {
  const { units, layerMap, sheets } = readDoc(raw, opts);
  const drawings: DrawingSummary[] = sheets.map((s) => ({ id: s.id, kind: s.kind, widthM: s.widthM, heightM: s.heightM, entityCount: s.entityCount }));
  return {
    scaleToMm: units.scaleToMm,
    scaleConfidence: 1 - units.errorPct,
    units,
    sheets,
    layerMap,
    drawings,
    selectedDrawingId: null,
    items: [],
    notes: [],
    wallSummaries: [],
  };
}

export function measureDoc(raw: DwgDoc, opts: TakeoffEngineOptions = {}): TakeoffResult {
  const { notes, expansion, doc, units, layerMap, sheets } = readDoc(raw, opts);

  const allLabels = sheets.flatMap((s) => s.labels);
  const height = storeyHeight(sheets);
  const elevations = sheets.filter((s) => s.kind === "elevation");
  const windowsFromElevations = elevations.map((sheet) => windowGroupsOnElevation({ doc, sheet, map: layerMap, units }));
  const windowAreaM2 = median(windowsFromElevations.map((w) => w.medianAreaM2).filter((a): a is number => a !== null));

  const items: MeasuredItem[] = [];
  const wallSummaries: WallSummary[] = [];
  for (const sheet of sheets) {
    if (sheet.kind !== "floor-plan" || !sheet.representative) continue;
    const ctx: SheetContext = { doc, sheet, map: layerMap, units };
    const columns = countColumns(ctx);
    const doors = countDoors(ctx);
    const windows = countWindowsOnPlan(ctx);
    const sanitary = countSanitary(ctx);
    const stair = stairs(ctx, allLabels);
    const mapped = wallSegments(doc, sheet, layerMap);
    // no layer mapped to walls on this plan: the wall rules run on every
    // unmapped line, and the lines say so
    const geometryOnly = mapped.length === 0;
    const segments = geometryOnly ? autoWallSegments(doc, sheet, layerMap, units.scaleToMm) : mapped;
    const runs = measureWallRuns(segments, units.scaleToMm, openingPoints(doc, sheet, layerMap));
    // sizes stated on the blocks themselves beat what is drawn or seen elsewhere
    const stated = attributeSizes(doc, sheet, layerMap);
    const openings = {
      doors: doors?.quantity ?? 0,
      doorWidthMm: medianOf(stated.doorWidthsMm) ?? doorWidthMm(ctx),
      windows: windows?.quantity ?? 0,
      windowAreaM2: medianOf(stated.windowAreasM2) ?? windowAreaM2,
    };
    const walls = wallItems(runs, height, openings, sheet, units);
    if (stated.tagged) for (const w of walls) w.basis += `; opening sizes from ${stated.tagged} block attributes`;
    const rooms = measureRooms(doc, sheet, segments, runs.seals, units, layerMap);
    const areaNote = statedAreaNote(rooms, sheet.code);
    if (areaNote) notes.push(areaNote);
    if (walls.length) {
      const summary = wallSummary(runs, height, openings, sheet, units);
      summary.checks.dimensions = dimensionCheck(doc, sheet, runs, units);
      summary.checks.roomPerimeters = perimeterCheck(runs, { totalM: rooms.perimeterM, rooms: rooms.items.length, unmeasured: rooms.unmeasured.length });
      annotateWalls(walls, summary);
      wallSummaries.push(summary);
    }
    // walls found without a wall layer are never better than medium, whatever the checks say
    if (geometryOnly) {
      for (const w of walls) {
        w.basis = `No layer mapped to walls: geometry only. ${w.basis}`;
        if (w.confidence === "high") w.confidence = "medium";
        w.reason = `no wall layer; paired faces on unmapped layers (${w.reason})`;
      }
      if (walls.length) notes.push(`${sheet.code}: no layer mapped to walls; walls measured from paired lines on unmapped layers.`);
    }
    // a plan whose window layer holds far fewer windows than one elevation
    // shows has most of its windows drawn on the wall layer: say so
    const perElevation = median(windowsFromElevations.map((w) => w.groups.length).filter((n) => n > 0));
    if (windows && perElevation !== null && perElevation > 2 * windows.quantity) {
      windows.confidence = "low";
      windows.reason = "window layer holds fewer windows than the elevations show";
      windows.crossCheck = `elevations show about ${perElevation} frame groups per face across all floors; count from the window schedule`;
    }
    const sheetItems = [...walls, columns, doors, windows, sanitary, stair, ...rooms.items].filter((i): i is MeasuredItem => i !== null);
    for (const item of sheetItems) items.push(multiply(item, sheet, sheets));
  }

  // windows seen on the elevations, one line per elevation, for the reviewer to reconcile
  elevations.forEach((sheet, i) => {
    const w = windowsFromElevations[i]!;
    if (!w.groups.length) return;
    items.push({
      trade: "windows",
      description: `Windows on ${sheet.title}`,
      quantity: w.groups.length,
      unit: "nr",
      confidence: "low",
      basis: `${w.groups.length} window frame groups on ${sheet.code}; ${w.medianAreaM2 ? `median ${w.medianAreaM2.toFixed(2)} m² each` : "sizes not read"}`,
      sheetId: sheet.id,
      evidence: handles(w.groups.flat()),
      reason: "from an elevation; faces overlap between views",
      crossCheck: "reconcile with the window schedule and the plan count",
      noteOnly: true,
    });
  });

  for (const item of items) {
    const flags = checkItem(item);
    if (flags.length) {
      item.confidence = "low";
      item.reason = `plausibility: ${flags.join(", ")}`;
    }
    // evidence cites real objects: geometry placed from a block cites the block reference
    if (item.evidence?.length) item.evidence = realHandles(item.evidence, expansion.origin);
  }
  if (!sheets.some((s) => s.kind === "floor-plan")) notes.push("No floor plan found among the drawings; nothing was measured.");
  const unmapped = Object.entries(layerMap).filter(([, v]) => v === "auto").map(([k]) => k);
  if (unmapped.length) notes.push(`Layers with no recognised element (left on auto): ${unmapped.join(", ")}.`);

  const drawings: DrawingSummary[] = sheets.map((s) => ({ id: s.id, kind: s.kind, widthM: s.widthM, heightM: s.heightM, entityCount: s.entityCount }));
  const representative = sheets.find((s) => s.kind === "floor-plan" && s.representative);
  return {
    scaleToMm: units.scaleToMm,
    scaleConfidence: 1 - units.errorPct,
    units,
    sheets,
    layerMap,
    drawings,
    selectedDrawingId: representative?.id ?? null,
    items,
    notes,
    wallSummaries,
  };
}

// A quantity measured on the representative floor is multiplied by the number
// of identical floors, and the basis says so, with the levels it stands for.
// The multiplication belongs to the line's own measurement sentence, not to
// the sheet summary that may follow it.
function withMultiplier(basis: string, suffix: string): string {
  const [first, ...rest] = basis.split(/\. (?=[A-Z])/);
  return [`${first} ${suffix}`, ...rest].join(". ");
}

function multiply(item: MeasuredItem, sheet: RegisterSheet, sheets: RegisterSheet[]): MeasuredItem {
  if (sheet.multiplier <= 1) return item;
  const group = sheets.filter((s) => s.group === sheet.group).map((s) => (s.levelMm !== null ? `+${s.levelMm}` : s.code));
  return {
    ...item,
    quantity: Math.round(item.quantity * sheet.multiplier * 100) / 100,
    multiplier: sheet.multiplier,
    basis: withMultiplier(item.basis, `× ${sheet.multiplier} identical floors (${group.join(", ")})`),
  };
}

function doorLeafWidths(doc: DwgDoc, map: LayerMap, scaleToMm: number): number[] {
  const widths: number[] = [];
  const fake: RegisterSheet = {
    id: -1,
    code: "",
    title: "",
    kind: "floor-plan",
    levelMm: null,
    levelName: null,
    bounds: { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity },
    widthM: 0,
    heightM: 0,
    entityCount: 0,
    group: 0,
    multiplier: 1,
    representative: true,
    labels: [],
    members: doc.entities.map((_, i) => i),
    textMembers: [],
  };
  const ctx: SheetContext = { doc, sheet: fake, map, units: { unit: "unknown", scaleToMm, basis: "assumed", errorPct: 0, samples: 0, note: "" } };
  // in drawing units: a leaf is 600–1500 of whatever unit the drawing uses,
  // so the band is tested at every unit scale by inferUnits itself
  for (const e of outlines(ctx, "doors", [0, Infinity])) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of e.points ?? []) {
      minX = Math.min(minX, p[0]!);
      maxX = Math.max(maxX, p[0]!);
      minY = Math.min(minY, p[1]!);
      maxY = Math.max(maxY, p[1]!);
    }
    widths.push(Math.max(maxX - minX, maxY - minY));
  }
  return widths;
}

// Where doors and windows sit: the midpoints of their lines and outlines and
// the insertion points of their blocks. Wall runs bridge the gaps these fill.
function openingPoints(doc: DwgDoc, sheet: RegisterSheet, map: LayerMap): Array<[number, number]> {
  const points: Array<[number, number]> = wallSegments(doc, sheet, map, ["doors", "windows"]).map((s) => [(s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2]);
  for (const i of sheet.members) {
    const e = doc.entities[i]!;
    if (e.entity !== "INSERT" || !e.ins_pt) continue;
    const element = elementOf(doc, e, map);
    if (element === "doors" || element === "windows") points.push([e.ins_pt[0]!, e.ins_pt[1]!]);
  }
  return points;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1]!;
}
