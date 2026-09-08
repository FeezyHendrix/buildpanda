import { parseLengthText } from "../geometry/length-text.ts";
import { blockNameOf, type DwgDoc, type DwgEntity } from "./dwg.ts";
import { elementOf } from "./taxonomy.ts";
import type { LayerMap, RegisterSheet } from "./types.ts";

// What a door or window block says about itself. Offices tag their blocks
// with a mark and a size ("D01", WIDTH 900; "W01", SIZE 1500x1200), and
// those values are the schedule the estimator would otherwise look up.

const WIDTH_TAG = /^(WIDTH|W|LEAF|SIZE|DIM)$/i;
const SIZE_TAG = /^(SIZE|DIM|WXH|W_X_H)$/i;
const SIZE_VALUE = /^(\d{3,4})\s*[xX×]\s*(\d{3,4})$/;

export interface AttributeSizes {
  doorWidthsMm: number[];
  windowAreasM2: number[];
  // how many blocks carried a usable size
  tagged: number;
}

function widthOf(attrs: Record<string, string>): number | null {
  for (const [tag, value] of Object.entries(attrs)) {
    if (!WIDTH_TAG.test(tag)) continue;
    const size = value.match(SIZE_VALUE);
    if (size) return Number(size[1]);
    const parsed = parseLengthText(value);
    const mm = parsed?.mm ?? parsed?.value ?? null;
    if (mm !== null && mm >= 500 && mm <= 3000) return mm;
  }
  return null;
}

function areaOf(attrs: Record<string, string>): number | null {
  for (const [tag, value] of Object.entries(attrs)) {
    if (!SIZE_TAG.test(tag)) continue;
    const size = value.match(SIZE_VALUE);
    if (!size) continue;
    const w = Number(size[1]);
    const h = Number(size[2]);
    if (w >= 300 && w <= 4000 && h >= 300 && h <= 3000) return (w * h) / 1e6;
  }
  return null;
}

/** Door widths and window areas stated by the block attributes on a sheet. */
export function attributeSizes(doc: DwgDoc, sheet: RegisterSheet, map: LayerMap): AttributeSizes {
  const out: AttributeSizes = { doorWidthsMm: [], windowAreasM2: [], tagged: 0 };
  for (const i of sheet.members) {
    const e: DwgEntity = doc.entities[i]!;
    if (e.entity !== "INSERT" || !e.attributes || !Object.keys(e.attributes).length) continue;
    const element = elementOf(doc, e, map);
    const name = blockNameOf(doc, e) ?? "";
    const isDoor = element === "doors" || /door|^d\d/i.test(name);
    const isWindow = element === "windows" || /win|^w\d/i.test(name);
    if (isDoor) {
      const w = widthOf(e.attributes);
      if (w !== null) {
        out.doorWidthsMm.push(w);
        out.tagged++;
      }
    } else if (isWindow) {
      const a = areaOf(e.attributes);
      if (a !== null) {
        out.windowAreasM2.push(a);
        out.tagged++;
      }
    }
  }
  return out;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1]!;
}
