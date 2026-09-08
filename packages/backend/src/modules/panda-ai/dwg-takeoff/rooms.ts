import { textOf, type DwgDoc } from "./dwg.ts";
import { measureRoomAreas } from "../pdf-takeoff/engine/measure.ts";
import type { DrawingRegion, Segment, TextRun } from "../pdf-takeoff/types.ts";
import { wallSegments, type WallSegment } from "./walls.ts";
import type { LayerMap, MeasuredItem, RegisterSheet, UnitsDecision } from "./types.ts";

// Room areas on a DWG use the same flood fill the PDF engine uses: the wall
// faces become the mask, the room labels seed it. The drawing's own stated
// area, when the architect wrote one, is the check.

const STATED_AREA = /(\d{2,5}(?:\.\d+)?)\s*(?:SQ(?:UARE)?\.?\s*M(?:ETRES?|ETERS?)?|M2|M²|SQM)/i;
// "each flat occupies 163 square metres": the figure is per dwelling, not per floor
const PER_UNIT = /\b(each|per|every)\s+(flat|unit|apartment|dwelling|house)\b|\b(flat|unit|apartment)\s+(is|occupies|has)\b/i;
const KITCHEN = /\bkitchen\b/i;
const ROOM_WORD = /bed|toilet|bath|kitchen|living|lounge|dining|office|store|lobby|corridor|hall|laundry|garage|balcony|terrace|veranda|pantry|study|dressing|maid|^wc|shw|shower|utility|closet|foyer|porch/i;

export interface RoomResult {
  items: MeasuredItem[];
  totalM2: number;
  statedM2: number | null;
  statedText: string | null;
  // the stated figure applies to one dwelling; kitchens count the dwellings
  perUnit: boolean;
  units: number;
  // room labels the flood fill could not enclose (open plan, or an opening it could not seal)
  unmeasured: string[];
}

/** How the flood-filled rooms compare with the architect's stated area. */
export function statedAreaNote(r: RoomResult, code: string): string | null {
  if (r.statedM2 === null || r.totalM2 <= 0) return null;
  const missing = r.unmeasured.length ? ` Not enclosed by the fill: ${summarise(r.unmeasured)}.` : "";
  const note = compare(r, code);
  return note + missing;
}

function summarise(labels: string[]): string {
  const tally = new Map<string, number>();
  for (const l of labels) tally.set(l, (tally.get(l) ?? 0) + 1);
  return [...tally.entries()].map(([l, n]) => (n > 1 ? `${l} ×${n}` : l)).join(", ");
}

function compare(r: RoomResult, code: string): string {
  const stated = r.statedM2 ?? 0;
  const agree = (target: number) => Math.abs(r.totalM2 - target) / target <= 0.1;
  if (!r.perUnit) {
    const diff = Math.round((Math.abs(r.totalM2 - stated) / stated) * 100);
    return `${code}: rooms sum to ${r.totalM2} m²; sheet states ${stated} m² (${agree(stated) ? "agree" : `differ by ${diff}%`}).`;
  }
  const k = [1, 2, 3, 4, 5, 6].find((n) => agree(n * stated));
  if (k) return `${code}: rooms sum to ${r.totalM2} m²; sheet states ${stated} m² per flat, which fits ${k} flat${k > 1 ? "s" : ""} (${r.units} kitchen${r.units > 1 ? "s" : ""} labelled).`;
  const expected = stated * r.units;
  const diff = Math.round((Math.abs(r.totalM2 - expected) / expected) * 100);
  return `${code}: rooms sum to ${r.totalM2} m²; sheet states ${stated} m² per flat × ${r.units} labelled kitchen${r.units > 1 ? "s" : ""} = ${expected} m² (differ by ${diff}%; check the room labels).`;
}

export function measureRooms(doc: DwgDoc, sheet: RegisterSheet, walls: WallSegment[], units: UnitsDecision, map: LayerMap): RoomResult {
  // the flood fill thinks in "points" with mmPerPt: a drawing unit is a point.
  // Door leaves, swings and window frames go into the mask with the walls so
  // that an opening wider than the fill can seal on its own is still closed.
  const openings = wallSegments(doc, sheet, map, ["doors", "windows"]);
  const segments: Segment[] = [...walls, ...openings].map((w) => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, len: w.len, width: 1, color: "" }));
  const texts: TextRun[] = [];
  for (const i of sheet.textMembers) {
    const e = doc.entities[i]!;
    const str = textOf(e);
    if (!str || !e.ins_pt) continue;
    const height = e.height ?? 250 / units.scaleToMm;
    texts.push({ str, x: e.ins_pt[0]!, y: e.ins_pt[1]!, w: height * 0.6 * str.length, rotated: false });
  }
  const region: DrawingRegion = { id: sheet.id, ...sheet.bounds, kind: "floor-plan", segmentIdx: [] };
  const rooms = measureRoomAreas(segments, texts, region, units.scaleToMm);

  const stated = sheet.labels.map((l) => ({ l, m: l.match(STATED_AREA) })).find((x) => x.m);
  const statedM2 = stated ? Number(stated.m![1]) : null;
  const perUnit = stated ? PER_UNIT.test(stated.l) : false;
  const kitchens = sheet.labels.filter((l) => KITCHEN.test(l)).length;
  const totalM2 = Math.round(rooms.reduce((s, r) => s + r.areaM2, 0) * 100) / 100;
  const measuredNames = new Map<string, number>();
  for (const r of rooms) measuredNames.set(r.name, (measuredNames.get(r.name) ?? 0) + 1);
  const unmeasured: string[] = [];
  for (const l of sheet.labels) {
    if (!ROOM_WORD.test(l) || l.length > 30) continue;
    const left = measuredNames.get(l) ?? 0;
    if (left > 0) measuredNames.set(l, left - 1);
    else unmeasured.push(l);
  }

  const items: MeasuredItem[] = rooms.map((r) => ({
    trade: "floor areas",
    description: `${r.name} — net floor area`,
    quantity: r.areaM2,
    unit: "m2",
    confidence: units.errorPct > 0.1 ? "low" : "medium",
    basis: `Flood fill inside the wall faces from the "${r.name}" label on ${sheet.code}`,
    sheetId: sheet.id,
    evidence: [],
    reason: "room polygon from wall network",
    crossCheck: statedM2 !== null ? `sheet states ${statedM2} m²${perUnit ? " per flat" : ""}` : "no stated area on the sheet",
  }));
  return { items, totalM2, statedM2, statedText: stated?.l ?? null, perUnit, units: Math.max(1, kitchens), unmeasured };
}
