import type { DwgDoc } from "./dwg.ts";
import { classifyRoof, linesInside, type RoofLine, type RoofShape } from "./roof-shape.ts";
import { roofArea, roofPanels } from "./roof-outline.ts";
import { classifyEdges, sharedEdges } from "./roof-edges.ts";
import { elementOf } from "./taxonomy.ts";
import type { LayerMap, MeasuredItem, RegisterSheet, UnitsDecision } from "./types.ts";

// A roof plan is drawn flat, so it gives up the plan area, the outline, and
// the lines where slopes meet. The pitch turns plan area into the area a
// roofer covers; when the drawing does not state it, the plan figure stands
// and says so rather than a guess being dressed up as a measurement.

const TYPE_LABEL: Record<RoofShape["type"], string> = {
  flat: "Flat roof",
  gable: "Gable roof",
  hipped: "Hipped roof",
  pitched: "Pitched roof",
};

const total = (lines: RoofLine[]): number => Math.round(lines.reduce((s, l) => s + l.lengthM, 0) * 100) / 100;
const asShapes = (lines: RoofLine[]) => lines.map((l) => ({ kind: "linear" as const, vertices: [l.a, l.b] }));

function line(
  sheet: RegisterSheet,
  description: string,
  quantity: number,
  lines: RoofLine[],
  basis: string,
  crossCheck: string,
): MeasuredItem {
  return {
    trade: "roof",
    description,
    quantity,
    unit: "m",
    confidence: "medium",
    basis,
    sheetId: sheet.id,
    reason: "measured on the roof plan",
    crossCheck,
    shapes: asShapes(lines),
    evidence: [],
  };
}

/**
 * What a roof plan yields: the type of roof, the covering, the eaves, and the
 * ridges, hips and valleys that go with that type. The covering is the sloped
 * area when the drawing states a pitch, and the plan area when it does not.
 */
export function measureRoof(doc: DwgDoc, sheet: RegisterSheet, map: LayerMap, units: UnitsDecision): MeasuredItem[] {
  // a hipped roof is drawn as its slopes: the roof is what they cover between them
  const panels = roofPanels(doc, sheet, map, units);
  const area = roofArea(panels, units);
  if (!area) return [];
  const outline = area.outline;
  const onRoofLayer = sheet.members.map((i) => doc.entities[i]!).filter((e) => e && elementOf(doc, e, map) === "roof").length;
  // where the roof is drawn as its panels, the edges they share ARE the ridges,
  // hips and valleys; a roof drawn as one outline with lines on it needs reading
  const shared = panels.length > 1 ? sharedEdges(panels, units) : [];
  const sorted = shared.length ? classifyEdges(shared, area, units) : undefined;
  // a drawing with a roof layer speaks through it; one without leaves its lines unmapped
  const wanted = onRoofLayer > 0 ? "roof" : "auto";
  const inside = sorted
    ? shared
    : linesInside(doc, sheet, outline, units, (e) => elementOf(doc, e, map) === wanted).filter((l) => !onOutline(l, outline, units));
  const roof = {
    ...classifyRoof(outline, inside, units.scaleToMm, sheet.labels, sorted),
    areaM2: area.areaM2,
    perimeterM: area.perimeterM,
  };
  const slope = roof.pitchDeg === null ? 1 : 1 / Math.cos((roof.pitchDeg * Math.PI) / 180);
  const covered = Math.round(roof.areaM2 * slope * 100) / 100;
  const pitchNote =
    roof.pitchDeg === null
      ? "no pitch is stated on the drawing, so this is the plan area, not the area a roofer covers"
      : `× ${Math.round(slope * 1000) / 1000} for the ${roof.pitchDeg}° pitch stated on the drawing`;

  const panelNote = area.panels > 1 ? `${area.panels} slope panels, measured as one roof` : "one outline";
  const items: MeasuredItem[] = [
    {
      trade: "roof",
      description: `${TYPE_LABEL[roof.type]} covering, ${roof.pitchDeg === null ? "measured on plan" : `at ${roof.pitchDeg}°`}`,
      quantity: covered,
      unit: "m2",
      confidence: roof.pitchDeg === null || roof.type === "pitched" ? "low" : "medium",
      basis: `${roof.areaM2} m² inside the roof outline on ${sheet.code} (${sheet.title}); ${pitchNote}`,
      sheetId: sheet.id,
      reason: roof.reason,
      crossCheck: `${roof.type} read from ${sorted ? "the edges the slope panels share" : "the lines drawn inside the outline"}: ${panelNote}, ${roof.ridges.length} ridges, ${roof.hips.length} hips, ${roof.valleys.length} valleys, ${roof.divisions.length} block joins; the roof layer holds ${onRoofLayer} objects`,
      shapes: [{ kind: "area", vertices: outline }],
      evidence: [],
    },
    line(
      sheet,
      roof.type === "gable" ? "Eaves and verges: fascia, soffit and gutter" : "Eaves: fascia, soffit and gutter",
      roof.perimeterM,
      [],
      `${roof.perimeterM} m round the roof outline on ${sheet.code}`,
      roof.type === "gable" ? "a gable's verge is not guttered; split the run before pricing" : "one run round the outline",
    ),
  ];
  items[1]!.shapes = [{ kind: "linear", vertices: [...outline, outline[0]!] }];

  if (roof.ridges.length) {
    items.push(
      line(sheet, "Ridge", total(roof.ridges), roof.ridges, `${total(roof.ridges)} m of ridge on ${sheet.code}`, `${roof.ridges.length} ridge lines`),
    );
  }
  if (roof.hips.length) {
    items.push(line(sheet, "Hips", total(roof.hips), roof.hips, `${total(roof.hips)} m of hip on ${sheet.code}`, `${roof.hips.length} hips`));
  }
  if (roof.valleys.length) {
    items.push(
      line(sheet, "Valleys", total(roof.valleys), roof.valleys, `${total(roof.valleys)} m of valley on ${sheet.code}`, `${roof.valleys.length} valleys`),
    );
  }
  if (roof.divisions.length) {
    items.push(
      line(
        sheet,
        "Roof edges between blocks: ridge or abutment",
        total(roof.divisions),
        roof.divisions,
        `${total(roof.divisions)} m of shared panel edge on ${sheet.code} running from one eaves point to another`,
        "the plan does not say whether these are ridges or abutments to a neighbouring block; price after checking the sections",
      ),
    );
    items[items.length - 1]!.confidence = "low";
  }
  return items;
}

/** A line lying along the outline is the outline's own edge, not a ridge. */
function onOutline(l: RoofLine, outline: number[][], units: UnitsDecision): boolean {
  const tolerance = 150 / units.scaleToMm;
  const near = (p: number[], a: number[], b: number[]) => {
    const dx = b[0]! - a[0]!;
    const dy = b[1]! - a[1]!;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p[0]! - a[0]!, p[1]! - a[1]!) <= tolerance;
    const t = Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / len2));
    return Math.hypot(p[0]! - (a[0]! + t * dx), p[1]! - (a[1]! + t * dy)) <= tolerance;
  };
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    if (near(l.a, a, b) && near(l.b, a, b)) return true;
  }
  return false;
}
