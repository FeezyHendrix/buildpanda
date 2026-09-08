import { parseDwgToJson, type DwgDoc } from "./dwg.ts";
import { inferUnits } from "./units.ts";
import { proposeLayerMap } from "./taxonomy.ts";
import { buildRegister } from "./register.ts";
import { countColumns, countDoors, countSanitary, countWindowsOnPlan, doorWidthMm, outlines, stairs, windowGroupsOnElevation, handles, type SheetContext } from "./elements.ts";
import { measureWallRuns, storeyHeight, wallItems, wallSegments } from "./walls.ts";
import { measureRooms, statedAreaNote } from "./rooms.ts";
import { checkItem } from "./plausibility.ts";
import type { DrawingSummary, LayerMap, MeasuredItem, RegisterSheet, TakeoffResult } from "./types.ts";

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

export function measureDoc(doc: DwgDoc, opts: TakeoffEngineOptions = {}): TakeoffResult {
  const notes: string[] = [];
  // a first pass with a provisional map gives units their door-width cross-check
  const provisional = opts.layerMap ?? proposeLayerMap(doc, 1).map;
  const provisionalUnits = inferUnits(doc);
  const doorWidths = doorLeafWidths(doc, provisional, provisionalUnits.scaleToMm);
  const units = inferUnits(doc, doorWidths);
  const layerMap = opts.layerMap ?? proposeLayerMap(doc, units.scaleToMm).map;
  const sheets = buildRegister(doc, units, layerMap);
  notes.push(units.note);

  const allLabels = sheets.flatMap((s) => s.labels);
  const height = storeyHeight(sheets);
  const elevations = sheets.filter((s) => s.kind === "elevation");
  const windowsFromElevations = elevations.map((sheet) => windowGroupsOnElevation({ doc, sheet, map: layerMap, units }));
  const windowAreaM2 = median(windowsFromElevations.map((w) => w.medianAreaM2).filter((a): a is number => a !== null));

  const items: MeasuredItem[] = [];
  for (const sheet of sheets) {
    if (sheet.kind !== "floor-plan" || !sheet.representative) continue;
    const ctx: SheetContext = { doc, sheet, map: layerMap, units };
    const columns = countColumns(ctx);
    const doors = countDoors(ctx);
    const windows = countWindowsOnPlan(ctx);
    const sanitary = countSanitary(ctx);
    const stair = stairs(ctx, allLabels);
    const segments = wallSegments(doc, sheet, layerMap);
    const runs = measureWallRuns(segments, units.scaleToMm);
    const walls = wallItems(
      runs,
      height,
      { doors: doors?.quantity ?? 0, doorWidthMm: doorWidthMm(ctx), windows: windows?.quantity ?? 0, windowAreaM2 },
      sheet,
      units,
    );
    const rooms = measureRooms(doc, sheet, segments, units, layerMap);
    const areaNote = statedAreaNote(rooms, sheet.code);
    if (areaNote) notes.push(areaNote);
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
    });
  });

  for (const item of items) {
    const flags = checkItem(item);
    if (flags.length) {
      item.confidence = "low";
      item.reason = `plausibility: ${flags.join(", ")}`;
    }
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
  };
}

// A quantity measured on the representative floor is multiplied by the number
// of identical floors, and the basis says so, with the levels it stands for.
function multiply(item: MeasuredItem, sheet: RegisterSheet, sheets: RegisterSheet[]): MeasuredItem {
  if (sheet.multiplier <= 1) return item;
  const group = sheets.filter((s) => s.group === sheet.group).map((s) => (s.levelMm !== null ? `+${s.levelMm}` : s.code));
  return {
    ...item,
    quantity: Math.round(item.quantity * sheet.multiplier * 100) / 100,
    multiplier: sheet.multiplier,
    basis: `${item.basis} × ${sheet.multiplier} identical floors (${group.join(", ")})`,
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

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1]!;
}
