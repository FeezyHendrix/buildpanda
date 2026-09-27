import type { RoofArea } from "./roof-outline.ts";
import type { RoofLine } from "./roof-shape.ts";
import type { UnitsDecision } from "./types.ts";

// A roof drawn as slope panels says where its slopes meet without anyone
// drawing a line for it: an edge two panels share IS a ridge, a hip or a
// valley. Which one it is follows from where the edge ends. A hip runs from a
// corner of the eaves up to a ridge; a valley runs from a re-entrant corner;
// a ridge touches the eaves at neither end. An edge that crosses the roof from
// one eaves point to another is neither — it is where two roof blocks abut,
// and it is reported as that rather than dressed up as a ridge.

const JOIN_MM = 150;
const PROBE_MM = 900;
const SAMPLES = 48;
const CONVEX_MAX = 0.42;
const REFLEX_MIN = 0.62;
const INSIDE_MIN = 0.95;

export type EdgeRole = "ridge" | "hip" | "valley" | "division";

export interface RoofEdges {
  ridges: RoofLine[];
  hips: RoofLine[];
  valleys: RoofLine[];
  /** Shared edges that run eaves to eaves: the join between two roof blocks. */
  divisions: RoofLine[];
}

type Corner = "convex" | "reflex" | "edge" | "inside";

/** How much roof surrounds a point: a quarter at an outside corner, all of it inside. */
function surround(point: number[], area: RoofArea, radius: number): number {
  let covered = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i / SAMPLES) * Math.PI * 2;
    if (area.covers([point[0]! + radius * Math.cos(t), point[1]! + radius * Math.sin(t)])) covered++;
  }
  return covered / SAMPLES;
}

export function cornerAt(point: number[], area: RoofArea, units: UnitsDecision): Corner {
  const fraction = surround(point, area, PROBE_MM / units.scaleToMm);
  if (fraction >= INSIDE_MIN) return "inside";
  if (fraction <= CONVEX_MAX) return "convex";
  if (fraction >= REFLEX_MIN) return "reflex";
  return "edge";
}

/** Edges that belong to two or more panels: the lines where the slopes meet. */
export function sharedEdges(panels: number[][][], units: UnitsDecision): RoofLine[] {
  const grid = JOIN_MM / units.scaleToMm;
  const key = (p: number[]) => `${Math.round(p[0]! / grid)},${Math.round(p[1]! / grid)}`;
  const found = new Map<string, { line: RoofLine; panels: number }>();
  for (const panel of panels) {
    const seen = new Set<string>();
    for (let i = 0; i < panel.length; i++) {
      const a = panel[i]!;
      const b = panel[(i + 1) % panel.length]!;
      const ka = key(a);
      const kb = key(b);
      if (ka === kb || seen.has([ka, kb].sort().join("|"))) continue;
      const id = [ka, kb].sort().join("|");
      seen.add(id);
      const hit = found.get(id);
      if (hit) {
        hit.panels++;
        continue;
      }
      const lengthM = (Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!) * units.scaleToMm) / 1000;
      found.set(id, { line: { a, b, lengthM: Math.round(lengthM * 100) / 100 }, panels: 1 });
    }
  }
  return [...found.values()].filter((e) => e.panels >= 2).map((e) => e.line);
}

/** Sort the shared edges by what their ends sit on. */
export function classifyEdges(edges: RoofLine[], area: RoofArea, units: UnitsDecision): RoofEdges {
  const out: RoofEdges = { ridges: [], hips: [], valleys: [], divisions: [] };
  for (const edge of edges) {
    const ends = [cornerAt(edge.a, area, units), cornerAt(edge.b, area, units)];
    const inside = ends.filter((e) => e === "inside").length;
    if (inside === 2) out.ridges.push(edge);
    else if (ends.includes("reflex")) out.valleys.push(edge);
    else if (inside === 1 && ends.includes("convex")) out.hips.push(edge);
    else out.divisions.push(edge);
  }
  return out;
}
