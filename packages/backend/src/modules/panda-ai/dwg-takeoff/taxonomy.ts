import { isModelSpace, type DwgDoc, type DwgEntity } from "./dwg.ts";
import { LAYER_ELEMENTS, type LayerElement, type LayerMap } from "./types.ts";

// Layer-name conventions seen on Nigerian and UK architectural drawings. Order
// matters: the first match wins, so "wallhatch" is ignored before "wall" claims it.
const NAME_RULES: Array<[RegExp, LayerElement]> = [
  [/hatch|pattern|fill/i, "ignore"],
  [/hide|hidden|xref|defpoint|viewport|vport|frame|border|title/i, "ignore"],
  [/dim|dimension/i, "dimensions"],
  [/^level|levels|datum/i, "levels"],
  [/text|anno|note|label|room ?name/i, "text"],
  [/grid|axis|axes|bubble/i, "grid"],
  [/column|col\b|stanchion|pillar|post/i, "columns"],
  [/door/i, "doors"],
  [/wind|window|glaz/i, "windows"],
  [/sanit|toilet|plumb|wc|bath|fixture|fitting/i, "sanitary"],
  [/stair|step|riser|ramp|handrail|balust/i, "stairs"],
  [/roof|purlin|rafter|gutter|fascia/i, "roof"],
  [/furn|equip|appliance|car\b|vehicle|tree|plant|landscape/i, "furniture"],
  [/wall|partition|masonry|blockw|brick|mur\b/i, "walls"],
];

export function elementForLayerName(name: string): LayerElement {
  for (const [re, element] of NAME_RULES) if (re.test(name)) return element;
  return "auto";
}

export interface LayerProfile {
  name: string;
  count: number;
  closed: number;
  inserts: number;
  proposed: LayerElement;
  note: string;
}

/**
 * Propose an element for every model-space layer. Names decide first; for a
 * layer that says nothing ("0", "A-1", "LAYER3") the contents decide: a layer
 * of compact closed squares is columns, one of many long paired lines is walls.
 */
export function proposeLayerMap(doc: DwgDoc, scaleToMm: number): { map: LayerMap; profiles: LayerProfile[] } {
  const stats = new Map<string, { count: number; closed: number; inserts: number; compact: number; long: number }>();
  for (const e of doc.entities) {
    if (!isModelSpace(doc, e)) continue;
    const name = doc.layerName(e);
    const st = stats.get(name) ?? { count: 0, closed: 0, inserts: 0, compact: 0, long: 0 };
    st.count++;
    if (e.entity === "INSERT") st.inserts++;
    if (e.entity === "LWPOLYLINE" && (e.flag ?? 0) & 512) {
      st.closed++;
      const size = polySize(e) * scaleToMm;
      if (size >= 150 && size <= 900) st.compact++;
    }
    if (e.entity === "LINE" && e.start && e.end) {
      if (Math.hypot(e.end[0]! - e.start[0]!, e.end[1]! - e.start[1]!) * scaleToMm >= 1000) st.long++;
    }
    stats.set(name, st);
  }
  const map: LayerMap = {};
  const profiles: LayerProfile[] = [];
  for (const [name, st] of stats) {
    let proposed = elementForLayerName(name);
    let note = proposed === "auto" ? "No convention in the name" : "From the layer name";
    if (proposed === "auto") {
      if (st.closed > 0 && st.compact / st.closed > 0.8 && st.closed >= 4) {
        proposed = "columns";
        note = `${st.compact} compact closed squares`;
      } else if (st.long >= 40 && st.long / Math.max(1, st.count) > 0.5) {
        note = "Mostly long lines; left on auto so wall rules can test it";
      }
    }
    map[name] = proposed;
    profiles.push({ name, count: st.count, closed: st.closed, inserts: st.inserts, proposed, note });
  }
  profiles.sort((a, b) => b.count - a.count);
  return { map, profiles };
}

export function isLayerElement(value: unknown): value is LayerElement {
  return typeof value === "string" && (LAYER_ELEMENTS as readonly string[]).includes(value);
}

/** The element an entity belongs to under a map; "auto" layers fall to geometry rules. */
export function elementOf(doc: DwgDoc, e: DwgEntity, map: LayerMap): LayerElement {
  return map[doc.layerName(e)] ?? elementForLayerName(doc.layerName(e));
}

export function polySize(e: DwgEntity): number {
  if (!e.points?.length) return 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of e.points) {
    minX = Math.min(minX, p[0]!);
    maxX = Math.max(maxX, p[0]!);
    minY = Math.min(minY, p[1]!);
    maxY = Math.max(maxY, p[1]!);
  }
  return Math.max(maxX - minX, maxY - minY);
}
