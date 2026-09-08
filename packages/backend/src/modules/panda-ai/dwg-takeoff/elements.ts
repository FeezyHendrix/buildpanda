import { blockNameOf, centroid, extentOf, handleOf, type DwgDoc, type DwgEntity } from "./dwg.ts";
import { elementOf, polySize } from "./taxonomy.ts";
import { isClosedOutline, isDoorSwing, isFitting, isSquareColumn, isWindowFrame, shapeSides } from "./shapes.ts";
import type { LayerElement, LayerMap, MeasuredItem, RegisterSheet, UnitsDecision } from "./types.ts";

// Every count is made by at least two methods where the drawing allows it.
// Agreement is recorded on the line; disagreement is the review reason.

export interface SheetContext {
  doc: DwgDoc;
  sheet: RegisterSheet;
  map: LayerMap;
  units: UnitsDecision;
}

export interface Method {
  label: string;
  count: number;
  evidence: number[];
}

export function entitiesOf(ctx: SheetContext, element: LayerElement): DwgEntity[] {
  return ctx.sheet.members.map((i) => ctx.doc.entities[i]!).filter((e) => elementOf(ctx.doc, e, ctx.map) === element);
}

const isClosed = isClosedOutline;
const sides = shapeSides;

/** Closed outlines on an element's layers within a size band (mm on the long side). */
export function outlines(ctx: SheetContext, element: LayerElement, longMm: [number, number], shortMax = Infinity): DwgEntity[] {
  return entitiesOf(ctx, element).filter((e) => {
    if (!isClosed(e)) return false;
    const s = sides(e, ctx.units.scaleToMm);
    return s.long >= longMm[0] && s.long <= longMm[1] && s.short <= shortMax;
  });
}

export function insertsNamed(ctx: SheetContext, re: RegExp): DwgEntity[] {
  return ctx.sheet.members
    .map((i) => ctx.doc.entities[i]!)
    .filter((e) => e.entity === "INSERT" && re.test(blockNameOf(ctx.doc, e) ?? ""));
}

/** Groups touching entities so a window drawn as frame + panes counts once. */
export function groupByProximity(ents: DwgEntity[], radiusUnits: number): DwgEntity[][] {
  const pts = ents.map((e) => ({ e, c: centroid(e) })).filter((p): p is { e: DwgEntity; c: [number, number] } => p.c !== null);
  const used = new Array<boolean>(pts.length).fill(false);
  const groups: DwgEntity[][] = [];
  for (let i = 0; i < pts.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const group = [pts[i]!.e];
    const stack = [i];
    while (stack.length) {
      const a = stack.pop()!;
      for (let j = 0; j < pts.length; j++) {
        if (used[j]) continue;
        if (Math.hypot(pts[a]!.c[0] - pts[j]!.c[0], pts[a]!.c[1] - pts[j]!.c[1]) <= radiusUnits) {
          used[j] = true;
          group.push(pts[j]!.e);
          stack.push(j);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

export const handles = (ents: DwgEntity[]): number[] => ents.map(handleOf).filter((h): h is number => h !== null);

/**
 * Combine methods into one line. The first method with evidence is the
 * quantity; the others are the cross-check. Agreement within 10 % is high
 * confidence, a single method is medium, disagreement is low with the reason.
 */
export function combine(
  trade: string,
  description: string,
  unit: string,
  methods: Method[],
  sheet: RegisterSheet,
): MeasuredItem | null {
  const live = methods.filter((m) => m.count > 0);
  if (!live.length) return null;
  const primary = live[0]!;
  const others = live.slice(1);
  const base = { trade, description, unit, quantity: primary.count, sheetId: sheet.id, evidence: primary.evidence };
  if (!others.length) {
    return { ...base, confidence: "medium", reason: "single method", basis: `${primary.count} ${primary.label} on ${sheet.code} (${sheet.title})`, crossCheck: "no second method available" };
  }
  const summary = others.map((m) => `${m.label} ${m.count}`).join(", ");
  const worst = Math.max(...others.map((m) => Math.abs(m.count - primary.count) / Math.max(primary.count, 1)));
  if (worst <= 0.1) {
    return { ...base, confidence: "high", reason: "methods agree", basis: `${primary.count} ${primary.label} on ${sheet.code} (${sheet.title}); ${summary} agree`, crossCheck: `${summary} · agree` };
  }
  return { ...base, confidence: "low", reason: "methods disagree", basis: `${primary.count} ${primary.label} on ${sheet.code} (${sheet.title}); ${summary} disagree`, crossCheck: `${summary} · disagree by ${Math.round(worst * 100)}%` };
}

export function countColumns(ctx: SheetContext): MeasuredItem | null {
  const byOutline = outlines(ctx, "columns", [150, 900]);
  const byAuto = entitiesOf(ctx, "auto").filter((e) => isSquareColumn(e, ctx.units.scaleToMm));
  const byBlock = insertsNamed(ctx, /col|column|stanchion|pillar/i);
  const primary = byOutline.length ? byOutline : byAuto;
  return combine(
    "columns",
    "Reinforced concrete columns",
    "nr",
    [
      { label: byOutline.length ? "column outlines" : "compact closed squares on unmapped layers", count: primary.length, evidence: handles(primary) },
      { label: "column blocks", count: byBlock.length, evidence: handles(byBlock) },
    ],
    ctx.sheet,
  );
}

export function doorWidthMm(ctx: SheetContext): number | null {
  const leaves = outlines(ctx, "doors", [600, 1500]).map((e) => sides(e, ctx.units.scaleToMm).long).sort((a, b) => a - b);
  return leaves.length ? leaves[leaves.length >> 1]! : null;
}

export function countDoors(ctx: SheetContext): MeasuredItem | null {
  // a leaf is 600–1500 mm; a double or sliding door outline runs to 2400 mm
  const leaves = outlines(ctx, "doors", [600, 2400], 300);
  const arcs = entitiesOf(ctx, "doors").filter((e) => {
    if (e.entity !== "ARC" || typeof e.radius !== "number") return false;
    const r = e.radius * ctx.units.scaleToMm;
    return r >= 500 && r <= 1500;
  });
  const blocks = insertsNamed(ctx, /door|dr-|^d\d/i);
  const methods: Method[] = [
    { label: "door leaf outlines", count: leaves.length, evidence: handles(leaves) },
    { label: "swing arcs", count: arcs.length, evidence: handles(arcs) },
    { label: "door blocks", count: blocks.length, evidence: handles(blocks) },
  ];
  // no door layer: the swings on unmapped layers are the doors
  if (methods.every((m) => m.count === 0)) {
    const swings = entitiesOf(ctx, "auto").filter((e) => isDoorSwing(e, ctx.units.scaleToMm));
    methods.push({ label: "swing arcs on unmapped layers", count: swings.length, evidence: handles(swings) });
  }
  return combine("doors", "Doors, as drawn (see door schedule for sizes)", "nr", methods, ctx.sheet);
}

export function countWindowsOnPlan(ctx: SheetContext): MeasuredItem | null {
  // on plan a window is a few lines or a thin frame across the wall; whatever
  // sits on the window layer within 300 mm is one window
  const frames = entitiesOf(ctx, "windows").filter((e) => {
    if (e.entity !== "LINE" && e.entity !== "LWPOLYLINE") return false;
    const ext = extentOf(e);
    if (!ext) return false;
    const long = Math.max(ext.maxX - ext.minX, ext.maxY - ext.minY) * ctx.units.scaleToMm;
    return long >= 400 && long <= 4000;
  });
  const groups = groupByProximity(frames, 300 / ctx.units.scaleToMm);
  const blocks = insertsNamed(ctx, /win|window|^w\d/i);
  const methods: Method[] = [
    { label: "window frame groups", count: groups.length, evidence: handles(frames) },
    { label: "window blocks", count: blocks.length, evidence: handles(blocks) },
  ];
  // no window layer: thin closed frames on unmapped layers are the windows
  if (methods.every((m) => m.count === 0)) {
    const thin = entitiesOf(ctx, "auto").filter((e) => isWindowFrame(e, ctx.units.scaleToMm));
    methods.push({ label: "thin closed frames on unmapped layers", count: groupByProximity(thin, 300 / ctx.units.scaleToMm).length, evidence: handles(thin) });
  }
  return combine("windows", "Windows, as drawn on plan (see window schedule for sizes)", "nr", methods, ctx.sheet);
}

/** Windows read off an elevation: frame outlines grouped so panes count once. */
export function windowGroupsOnElevation(ctx: SheetContext): { groups: DwgEntity[][]; medianAreaM2: number | null } {
  const frames = outlines(ctx, "windows", [300, 4000]);
  const groups = groupByProximity(frames, 300 / ctx.units.scaleToMm);
  const areas = groups
    .map((g) => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const e of g) for (const p of e.points ?? []) {
        minX = Math.min(minX, p[0]!);
        maxX = Math.max(maxX, p[0]!);
        minY = Math.min(minY, p[1]!);
        maxY = Math.max(maxY, p[1]!);
      }
      const s = ctx.units.scaleToMm / 1000;
      return (maxX - minX) * s * ((maxY - minY) * s);
    })
    .filter((a) => a > 0.1 && a < 12)
    .sort((a, b) => a - b);
  return { groups, medianAreaM2: areas.length ? areas[areas.length >> 1]! : null };
}

const FITTING_BLOCK = /wc|clos|sink|snk|whb|basin|bath|shw|shower|urin|lav|toil|bidet|cist/i;

/**
 * Sanitary fittings are blocks (a WC, a sink) and drawn outlines (a bath, a
 * shower tray, a basin in a vanity). Method one: blocks plus the outline
 * groups that stand clear of any block. Method two: everything on the
 * sanitary layer, blocks included, grouped by footprint.
 */
export function countSanitary(ctx: SheetContext): MeasuredItem | null {
  const blocks = insertsNamed(ctx, FITTING_BLOCK);
  const radius = 400 / ctx.units.scaleToMm;
  const drawn = entitiesOf(ctx, "sanitary").filter((e) => isClosed(e) || e.entity === "CIRCLE");
  const near = (e: DwgEntity) => {
    const c = centroid(e);
    return !!c && blocks.some((b) => {
      const cb = centroid(b);
      return !!cb && Math.hypot(cb[0] - c[0], cb[1] - c[1]) <= 2 * radius;
    });
  };
  const clear = groupByProximity(drawn.filter((e) => !near(e)), radius);
  const footprint = groupByProximity([...blocks, ...drawn], radius);
  const methods: Method[] = [
    { label: "sanitary blocks and drawn fittings", count: blocks.length + clear.length, evidence: handles([...blocks, ...clear.flat()]) },
    { label: "fitting footprints on the sanitary layer", count: footprint.length, evidence: handles(footprint.flat()) },
  ];
  // no sanitary layer or blocks: compact oblong outlines on unmapped layers
  if (methods.every((m) => m.count === 0)) {
    const oblongs = entitiesOf(ctx, "auto").filter((e) => isFitting(e, ctx.units.scaleToMm));
    methods.push({ label: "compact oblong outlines on unmapped layers", count: groupByProximity(oblongs, radius).length, evidence: handles(oblongs) });
  }
  const item = combine("sanitary", "Sanitary fittings (WC, basin, sink, shower, bath)", "nr", methods, ctx.sheet);
  if (item && blocks.length) {
    const names = new Map<string, number>();
    for (const b of blocks) {
      const n = blockNameOf(ctx.doc, b) ?? "block";
      names.set(n, (names.get(n) ?? 0) + 1);
    }
    item.basis += `; blocks: ${[...names.entries()].map(([n, c]) => `${n} ×${c}`).join(", ")}; ${clear.length} drawn outlines clear of a block`;
  }
  return item;
}

const RISERS = /(\d{1,3})\s*NOS?\.?\s*(?:OF\s+)?RISERS?\s*(?:OF|@|AT)?\s*(\d{2,4})\s*MM/i;

/**
 * Stairs come from the note the architect wrote on this plan (or, failing
 * that, anywhere on the drawing), cross-checked against the step lines.
 */
export function stairs(ctx: SheetContext, allLabels: string[]): MeasuredItem | null {
  const own = ctx.sheet.labels.map((l) => l.match(RISERS)).filter((m): m is RegExpMatchArray => !!m);
  const notes = own.length ? own : allLabels.map((l) => l.match(RISERS)).filter((m): m is RegExpMatchArray => !!m);
  const note = notes[0];
  const stepLines = entitiesOf(ctx, "stairs").filter((e) => e.entity === "LINE");
  if (!note) return null;
  const risers = Number(note[1]);
  const riserMm = Number(note[2]);
  const flightsFromLines = stepLines.length > 0 ? Math.round(stepLines.length / risers) : 0;
  const others = notes.slice(1).map((m) => `"${m[0]}"`);
  return {
    trade: "stairs",
    description: `Staircase: ${risers} risers of ${riserMm} mm (rise ${Math.round((risers * riserMm) / 10) / 100} m)`,
    quantity: 1,
    unit: "nr",
    confidence: flightsFromLines >= 1 ? "high" : "medium",
    basis: `Architect's note "${note[0]}"${own.length ? "" : " (from another drawing)"}; ${stepLines.length} step lines on ${ctx.sheet.code}` + (others.length ? `; also noted: ${others.join(", ")}` : ""),
    sheetId: ctx.sheet.id,
    evidence: handles(stepLines),
    crossCheck: stepLines.length ? `${stepLines.length} step lines ≈ ${flightsFromLines} flight(s)` : "no step lines on the plan",
    reason: flightsFromLines >= 1 ? "note and step lines agree" : "note only",
  };
}

export { polySize };
